import torch
import numpy as np
import pandas as pd
from fastapi import FastAPI, HTTPException, Query
from pydantic import BaseModel
from typing import List, Optional
import torch.nn as nn
from math import radians, sin, cos, sqrt, atan2
import warnings
import os
from pathlib import Path

warnings.filterwarnings("ignore")
import torch.serialization
from sklearn.preprocessing import MinMaxScaler
import numpy
# Allow numpy reconstruction for weights_only=True
try:
    # Handle both old and new numpy paths
    if hasattr(numpy, "_core") and hasattr(numpy._core, "multiarray") and hasattr(numpy._core.multiarray, "_reconstruct"):
        torch.serialization.add_safe_globals([numpy._core.multiarray._reconstruct])
    elif hasattr(numpy, "core") and hasattr(numpy.core, "multiarray") and hasattr(numpy.core.multiarray, "_reconstruct"):
        torch.serialization.add_safe_globals([numpy.core.multiarray._reconstruct])
    
    torch.serialization.add_safe_globals([numpy.dtype, numpy.ndarray])
    if hasattr(numpy, "dtypes") and hasattr(numpy.dtypes, "Float64DType"):
        torch.serialization.add_safe_globals([numpy.dtypes.Float64DType])
except Exception:
    pass

torch.serialization.add_safe_globals([MinMaxScaler])

BASE_DIR = Path(__file__).resolve().parent
DATA_DIR = BASE_DIR.parent / "ai_bharat"



class RNNAttentionDemandPredictor(nn.Module):
    def __init__(self, input_size, hidden_size, num_layers=1):
        super(RNNAttentionDemandPredictor, self).__init__()
        self.rnn = nn.RNN(input_size, hidden_size, num_layers, batch_first=True)
        self.attention_weights = nn.Linear(hidden_size, 1)
        self.fc = nn.Linear(hidden_size, 1)
        self.sigmoid = nn.Sigmoid()

    def forward(self, x, temperature=1.5):
        rnn_out, _ = self.rnn(x)
        attn_scores = self.attention_weights(rnn_out)
        attn_weights = torch.softmax(attn_scores / temperature, dim=1)
        context_vector = torch.sum(attn_weights * rnn_out, dim=1)
        output = self.fc(context_vector)
        return self.sigmoid(output), attn_weights




app = FastAPI(
    title="EV Smart Grid AI Engine",
    version="2.0.0",
    description=(
        "Two-module AI backend: "
        "(A) Temporal-Attention RNN for EV charging demand prediction, "
        "(B) Floyd-Warshall graph engine for station placement, rerouting, and coverage gap analysis."
    )
)

from fastapi.middleware.cors import CORSMiddleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], # In production, specify the frontend URL
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)



_demand_model   = None
_scaler_X       = None
_scaler_y       = None
_input_dim      = None
_target_col     = None

try:
    model_path = DATA_DIR / "ev_demand_model_v1.pth"
    checkpoint = torch.load(str(model_path), map_location=torch.device("cpu"), weights_only=True)
    _scaler_X   = checkpoint["scaler_X"]
    _scaler_y   = checkpoint["scaler_y"]
    _input_dim  = checkpoint["input_size"]
    _target_col = checkpoint["target_col"]
    _demand_model = RNNAttentionDemandPredictor(_input_dim, 64)
    _demand_model.load_state_dict(checkpoint["model_state_dict"])
    _demand_model.eval()
    print(f"[BOOT] Demand model loaded from {model_path}")
except Exception as e:
    print(f"[BOOT] Demand model failed to load from {DATA_DIR}: {e}. Demand endpoints will return 503.")





def _load_zone_graph():
   

    
    zone_df     = pd.read_csv(DATA_DIR / "zone_data_augmented_aug2.csv")
    priority_df = pd.read_csv(DATA_DIR / "zone_priority_augmented_aug2.csv")
    dem_df      = pd.read_csv(DATA_DIR / "zone_demand_summary_augmented_aug2.csv")
    schedule_df = pd.read_csv(DATA_DIR / "charging_schedule_augmented_aug2.csv")
    build_df    = pd.read_csv(DATA_DIR / "station_build_priority.csv")
    gap_df      = pd.read_csv(DATA_DIR / "coverage_gap_analysis.csv")
    reroute_df  = pd.read_csv(DATA_DIR / "smart_rerouting.csv")

   
    zone_agg  = zone_df.groupby("zone").mean(numeric_only=True).reset_index()
    prio_agg  = priority_df.groupby("zone")[["score"]].mean().reset_index()
    dem_agg   = dem_df.groupby("zone").mean(numeric_only=True).reset_index()
    peak_stats = schedule_df.groupby("zone")["demand"].agg(
        avg_demand="mean", max_demand="max", demand_std="std"
    ).reset_index()

    peak_hour = (
        schedule_df[schedule_df["recommendation"] == "PEAK"]
        .groupby("zone")["hour"].mean()
        .reset_index()
        .rename(columns={"hour": "avg_peak_hour"})
    )

    merge = (zone_agg
        .merge(prio_agg,   on="zone")
        .merge(dem_agg,    on="zone")
        .merge(peak_stats, on="zone")
        .merge(peak_hour,  on="zone", how="left")
    )
    if "avg_demand_x" in merge.columns:
        merge = merge.rename(columns={"avg_demand_x": "avg_demand"}).drop(
            columns=["avg_demand_y"], errors="ignore")

    merge["congestion_index"] = (
        merge["ev_density"] * merge["max_demand"]
    ) / merge["stations"].clip(lower=0.5)

    def _norm(s):
        mn, mx = s.min(), s.max()
        return (s - mn) / (mx - mn + 1e-9)

    merge["ci_norm"]       = _norm(merge["congestion_index"])
    merge["dem_norm"]      = _norm(merge["avg_demand"])
    merge["ev_dens_norm"]  = _norm(merge["ev_density"])
    merge["sta_norm"]      = _norm(merge["stations"])
    ci_median = merge["congestion_index"].median()
    merge["overloaded"]    = merge["congestion_index"] > ci_median


    def haversine(lat1, lon1, lat2, lon2):
        R = 6371.0
        phi1, phi2 = radians(lat1), radians(lat2)
        dphi = radians(lat2 - lat1)
        dlam = radians(lon2 - lon1)
        a = sin(dphi/2)**2 + cos(phi1)*cos(phi2)*sin(dlam/2)**2
        return R * 2 * atan2(sqrt(a), sqrt(1-a))

  
    zones = merge["zone"].tolist()
    n     = len(zones)
    INF   = float("inf")

    dist_matrix   = {u: {v: INF for v in zones} for u in zones}
    weight_matrix = {u: {v: INF for v in zones} for u in zones}
    raw_km        = {u: {v: 0.0 for v in zones} for u in zones}

    for z in zones:
        dist_matrix[z][z]   = 0.0
        weight_matrix[z][z] = 0.0

    for i, z1 in enumerate(zones):
        for j, z2 in enumerate(zones):
            if i >= j:
                continue
            r1 = merge[merge.zone == z1].iloc[0]
            r2 = merge[merge.zone == z2].iloc[0]
            km = haversine(r1.lat, r1.lon, r2.lat, r2.lon)
            raw_km[z1][z2] = raw_km[z2][z1] = round(km, 3)
            cong_f  = 1 + (r1.ci_norm  + r2.ci_norm)  / 2
            dem_f   = 1 + (r1.dem_norm + r2.dem_norm)  / 2
            w = round(km * cong_f * dem_f, 4)
            weight_matrix[z1][z2] = weight_matrix[z2][z1] = w
            dist_matrix[z1][z2]   = dist_matrix[z2][z1]   = w

  
    pred = {u: {v: v for v in zones} for u in zones}
    for k in zones:
        for u in zones:
            for v in zones:
                if dist_matrix[u][k] + dist_matrix[k][v] < dist_matrix[u][v]:
                    dist_matrix[u][v] = dist_matrix[u][k] + dist_matrix[k][v]
                    pred[u][v] = pred[u][k]

    def reconstruct_path(u, v):
        if u == v:
            return [u]
        path = [u]
        while path[-1] != v:
            path.append(pred[path[-1]][v])
        return path

    return merge, dist_matrix, pred, weight_matrix, raw_km, reconstruct_path, \
           gap_df, build_df, reroute_df, schedule_df


try:
    (MERGE, FW_DIST, FW_PRED, W_MATRIX, RAW_KM, RECONSTRUCT,
     GAP_DF, BUILD_DF, REROUTE_DF, SCHEDULE_DF) = _load_zone_graph()
    ZONES = MERGE["zone"].tolist()
    print(f"[BOOT] Zone graph loaded. Zones: {ZONES}")
except Exception as e:
    print(f"[BOOT] Zone graph failed: {e}")
    MERGE = FW_DIST = FW_PRED = W_MATRIX = RAW_KM = RECONSTRUCT = None
    GAP_DF = BUILD_DF = REROUTE_DF = SCHEDULE_DF = None
    ZONES = []


def _graph_ready():
    if MERGE is None:
        raise HTTPException(503, "Zone graph engine not initialised. Check CSV paths.")




class SequenceInput(BaseModel):
    data_window: List[List[float]]




@app.get("/", tags=["Health"])
async def health_check():
    return {
        "status": "online",
        "modules": {
            "demand_rnn": "loaded" if _demand_model else "unavailable",
            "zone_graph": "loaded" if MERGE is not None else "unavailable"
        },
        "zones_active": ZONES,
    }

@app.post("/predict/demand", tags=["Demand Prediction"])
async def predict_demand(input_data: SequenceInput):
  
    if _demand_model is None:
        raise HTTPException(503, "Demand model checkpoint not found.")
    try:
        x_raw    = np.array(input_data.data_window)
        x_scaled = _scaler_X.transform(x_raw)
        x_tensor = torch.tensor(x_scaled, dtype=torch.float32).unsqueeze(0)

        with torch.no_grad():
            pred_scaled, attn_weights = _demand_model(x_tensor)

        demand_pct   = _scaler_y.inverse_transform(pred_scaled.numpy())[0][0]
        weights      = attn_weights.squeeze().numpy()
        latest_step  = x_raw[-1]
        weekday_map  = {0:"Mon",1:"Tue",2:"Wed",3:"Thu",4:"Fri",5:"Sat",6:"Sun"}
        max_attn_idx = int(np.argmax(weights))
        time_lag     = (6 - max_attn_idx) * 2

        return {
            "prediction": {
                "demand_percentage": round(float(demand_pct), 2),
                "unit": "%",
                "risk_level": "High" if demand_pct > 75 else "Stable"
            },
            "current_conditions": {
                "weekday":              weekday_map.get(int(latest_step[-3]), "Unknown"),
                "consumption_rate_kw":  round(float(latest_step[0]), 2),
                "energy_drawn_kwh":     round(float(latest_step[1]), 2)
            },
            "ai_insight": {
                "dominant_influence_window": f"-{time_lag} hours ago",
                "attention_score":           round(float(weights[max_attn_idx]), 4),
                "analysis": "The model identified a significant historical spike influencing current demand."
            }
        }
    except Exception as e:
        raise HTTPException(400, str(e))


@app.get("/model/metadata", tags=["Demand Prediction"])
async def get_metadata():
    return {
        "architecture":         "RNN with Temporal Attention",
        "input_window":         "12 Hours (6 steps x 2H)",
        "features_count":       _input_dim,
        "feature_names":        getattr(_scaler_X, "feature_names_in_", None).tolist() if hasattr(_scaler_X, "feature_names_in_") else None,
        "temperature_smoothing": 1.5,
        "optimization":         "Spike-Weighted MSE"
    }




@app.get("/zone/station-priority")
async def station_priority(zone: Optional[str] = Query(None, description="Filter by zone (A-E)")):
  
    _graph_ready()

    df = BUILD_DF.copy()
    if zone:
        zone = zone.upper()
        if zone not in ZONES:
            raise HTTPException(404, f"Zone '{zone}' not found. Valid zones: {ZONES}")
        df = df[df["zone"] == zone]

    results = []
    for _, row in df.iterrows():
        z    = row["zone"]
        zrow = MERGE[MERGE.zone == z].iloc[0]

        reasons = []
        if row["ev_density"] > MERGE["ev_density"].median():
            reasons.append(
                f"EV density {row['ev_density']:.0f} exceeds city median "
                f"({MERGE['ev_density'].median():.0f})"
            )
        if row["population"] > MERGE["population"].median():
            reasons.append(
                f"Population {int(row['population'])} exceeds city median "
                f"({int(MERGE['population'].median())})"
            )
        if row["overloaded"]:
            reasons.append(
                f"Congestion index {row['congestion_index']:.0f} — "
                "existing stations are overloaded"
            )
        if row["graph_recommended"]:
            reasons.append(
                "Floyd-Warshall identified this zone as a critical coverage bridge — "
                "score multiplied ×2"
            )
        if row["existing_stations"] < 1:
            reasons.append("Zone currently has NO charging station")
        if not reasons:
            reasons.append("Moderate demand — adequately served, lower urgency")

        
        zone_sched = SCHEDULE_DF[SCHEDULE_DF.zone == z]
        peak_hours = sorted(zone_sched[zone_sched.recommendation == "PEAK"]["hour"].unique())
        offpeak_hours = sorted(
            zone_sched[zone_sched.recommendation == "OFF-PEAK"]["hour"].unique()
        )
        max_demand_val = zone_sched["demand"].max()

        results.append({
            "rank":                  int(row["position"]),
            "zone":                  z,
            "build_score":           round(float(row["build_score"]), 4),
            "stations_recommended":  int(row["stations_recommended"]),
            "existing_stations":     round(float(row["existing_stations"]), 1),
            "ev_density":            round(float(row["ev_density"]), 1),
            "population":            int(row["population"]),
            "congestion_index":      round(float(row["congestion_index"]), 1),
            "overloaded":            bool(row["overloaded"]),
            "graph_recommended":     bool(row["graph_recommended"]),
            "location":              {"lat": round(float(zrow.lat), 4),
                                      "lon": round(float(zrow.lon), 4)},
            "demand_profile": {
                "avg_demand_kw":     round(float(zrow.avg_demand), 1),
                "max_demand_kw":     round(float(max_demand_val), 1),
                "avg_peak_hour":     round(float(zrow.avg_peak_hour), 1)
                                     if pd.notna(zrow.avg_peak_hour) else None,
                "peak_hours":        [int(h) for h in peak_hours[:5]],
                "recommended_offpeak_windows": [int(h) for h in offpeak_hours[:5]],
            },
            "why_build_here":        reasons,
        })

    summary = {
        "total_new_stations_needed": int(df["stations_recommended"].sum()),
        "overloaded_zones":  df[df["overloaded"] == True]["zone"].tolist(),
        "graph_bridge_zones": df[df["graph_recommended"] == True]["zone"].tolist(),
    }

    return {
        "endpoint":  "station_priority",
        "algorithm": "Floyd-Warshall weighted graph + ANN zone scoring",
        "summary":   summary,
        "ranked_zones": results
    }




@app.get("/zone/coverage-gaps")
async def coverage_gaps(
    zone: Optional[str] = Query(None, description="Filter gaps involving this zone"),
    only_actionable: bool = Query(False, description="Return only gaps with a valid bridge zone")
):
   
    _graph_ready()

    df = GAP_DF.copy()
    if zone:
        zone = zone.upper()
        df   = df[df["gap_pair"].str.contains(zone)]

    if only_actionable:
        df = df[df["benefit_score"] > 0]

    if df.empty:
        return {"endpoint": "coverage_gaps", "gaps": [],
                "message": "No gaps match the filter criteria."}

    gaps = []
    for _, row in df.iterrows():
        z1, z2 = row["gap_pair"].replace(" ", "").split("↔")
        rec_zone = str(row["recommended_zone"]) if pd.notna(row["recommended_zone"]) else None

        # Weight breakdown for the direct edge
        direct_w = round(float(row["direct_weight"]), 3)
        km       = round(float(row["raw_distance_km"]), 2)

        
        rec_build_rank = None
        if rec_zone and rec_zone in ZONES:
            match = BUILD_DF[BUILD_DF.zone == rec_zone]
            if not match.empty:
                rec_build_rank = int(match.iloc[0]["position"])

        is_bridgeable = float(row["benefit_score"]) > 0

        gaps.append({
            "gap_pair":         row["gap_pair"],
            "zones_involved":   [z1, z2],
            "raw_distance_km":  km,
            "direct_weight":    direct_w,
            "floyd_warshall_path": row["fw_path"],
            "is_bridgeable":    is_bridgeable,
            "recommended_intermediate_zone": rec_zone if is_bridgeable else None,
            "intermediate_build_rank":       rec_build_rank,
            "cost_reduction_pct": round(float(row["cost_reduction_pct"]), 1)
                                   if is_bridgeable else 0.0,
            "benefit_score":    round(float(row["benefit_score"]), 3),
            "action": (
                f"Build station at Zone {rec_zone} — reduces routing cost by "
                f"{row['cost_reduction_pct']:.1f}%"
            ) if is_bridgeable else (
                "No existing zone bridges this gap — propose a new intermediate site "
                f"between {z1} and {z2}"
            ),
            "why": (
                f"Zone {rec_zone} is geographically positioned between {z1} and {z2}, "
                f"has high EV density, is underserved, and bridges the {km} km gap "
                f"with a benefit score of {row['benefit_score']:.1f}."
            ) if is_bridgeable else (
                f"All candidate intermediate zones produce a higher routing cost than "
                f"the direct edge ({direct_w}). A genuinely new station location between "
                f"{z1} and {z2} is required."
            )
        })

    summary = {
        "total_gaps":              len(gaps),
        "bridgeable_by_existing":  sum(1 for g in gaps if g["is_bridgeable"]),
        "need_new_site":           sum(1 for g in gaps if not g["is_bridgeable"]),
        "threshold_km":            50,
    }

    return {
        "endpoint":  "coverage_gaps",
        "algorithm": "Floyd-Warshall all-pairs + benefit scoring",
        "summary":   summary,
        "gaps":      gaps
    }




@app.get("/zone/reroute")
async def smart_reroute(
    from_zone: str = Query(..., description="Zone where EV currently is (A-E)"),
    reason:    str = Query("overloaded", description="Reason: 'overloaded' or 'distance'")
):
    
    _graph_ready()

    from_zone = from_zone.upper()
    if from_zone not in ZONES:
        raise HTTPException(404, f"Zone '{from_zone}' not found. Valid: {ZONES}")

    zone_row   = MERGE[MERGE.zone == from_zone].iloc[0]
    is_overloaded = bool(zone_row.overloaded)

    df = REROUTE_DF[REROUTE_DF["from_zone"] == from_zone].copy()
    if df.empty:
        print(f"DEBUG: No reroute alternatives found for Zone {from_zone}")
        return {
            "endpoint": "smart_rerouting",
            "origin_zone": from_zone,
            "origin_overloaded": is_overloaded,
            "all_alternatives": []
        }

    df = df.sort_values("effective_cost").reset_index(drop=True)

    alternatives = []
    for _, row in df.iterrows():
        dest      = row["to_zone"]
        dest_row  = MERGE[MERGE.zone == dest].iloc[0]

        dest_sched    = SCHEDULE_DF[SCHEDULE_DF.zone == dest]
        dest_offpeak  = sorted(
            dest_sched[dest_sched.recommendation == "OFF-PEAK"]["hour"].unique()
        )
        dest_stations = round(float(dest_row.stations), 1)
        dest_ci       = round(float(dest_row.congestion_index), 1)
        dest_capacity = "AVAILABLE" if not bool(row["dest_overloaded"]) else "LIMITED"

        alternatives.append({
            "destination_zone":   dest,
            "fw_path":            row["path"],
            "fw_cost":            round(float(row["fw_cost"]), 3),
            "effective_cost":     round(float(row["effective_cost"]), 3),
            "penalty_applied":    bool(row["dest_overloaded"]),
            "destination_status": dest_capacity,
            "destination_stations": dest_stations,
            "destination_congestion_index": dest_ci,
            "destination_location": {
                "lat": round(float(dest_row.lat), 4),
                "lon": round(float(dest_row.lon), 4)
            },
            "recommended_offpeak_hours": [int(h) for h in dest_offpeak[:4]],
            "why_ranked_here": (
                f"Zone {dest} is reachable via {row['path']} with effective cost "
                f"{row['effective_cost']:.2f}. "
                + ("Destination is also overloaded — 1.5× penalty applied. "
                   if row["dest_overloaded"] else
                   "Destination has available charging capacity — no penalty. ")
                + f"Congestion index: {dest_ci}."
            )
        })

    best = alternatives[0]

    return {
        "endpoint":        "smart_reroute",
        "origin_zone":     from_zone,
        "origin_status": {
            "overloaded":        is_overloaded,
            "congestion_index":  round(float(zone_row.congestion_index), 1),
            "ev_density":        round(float(zone_row.ev_density), 1),
            "existing_stations": round(float(zone_row.stations), 1),
        },
        "reroute_reason":  reason,
        "recommendation": {
            "go_to_zone":        best["destination_zone"],
            "path":              best["fw_path"],
            "effective_cost":    best["effective_cost"],
            "status":            best["destination_status"],
            "offpeak_windows":   best["recommended_offpeak_hours"],
            "why": (
                f"Zone {best['destination_zone']} is the optimal reroute from Zone {from_zone}. "
                f"Path: {best['fw_path']}. Effective routing cost: {best['effective_cost']:.2f}. "
                f"Destination capacity: {best['destination_status']}."
            )
        },
        "all_alternatives": alternatives
    }
if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
