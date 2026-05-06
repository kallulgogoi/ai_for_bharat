import pandas as pd
import numpy as np
import os
from scipy.spatial.distance import cdist

# -------------------------------
# STEP 1: Create Data Folder
# -------------------------------
os.makedirs("data", exist_ok=True)

# -------------------------------
# STEP 2: Define Zones
# -------------------------------
zones = ['A','B','C','D','E']

# -------------------------------
# STEP 3: Generate Demand Dataset
# -------------------------------
demand_data = []

for zone in zones:
    base_ev = np.random.randint(150, 300)

    for hour in range(24):

        # realistic demand pattern
        if 17 <= hour <= 21:
            demand = np.random.randint(250, 400)   # peak
        elif 8 <= hour <= 11:
            demand = np.random.randint(120, 200)   # medium
        else:
            demand = np.random.randint(50, 120)    # low

        ev_count = base_ev + np.random.randint(-30, 30)

        demand_data.append([zone, hour, ev_count, demand])

df = pd.DataFrame(demand_data, columns=[
    'zone','hour','ev_count','demand'
])

df.to_csv("data/demand_data.csv", index=False)
print("demand_data.csv created")

# -------------------------------
# STEP 4: Generate Zone Dataset
# -------------------------------
zone_data = pd.DataFrame({
    'zone': zones,
    'population': [5000, 8000, 3000, 10000, 6000],
    'stations': [2, 1, 0, 3, 1],
    'lat': [12.97, 12.98, 12.96, 12.99, 12.95],
    'lon': [77.59, 77.60, 77.58, 77.61, 77.57]
})

# Add EV density
zone_data['ev_density'] = zone_data['population'] * 0.05

zone_data.to_csv("data/zone_data.csv", index=False)
print("zone_data.csv created")

# -------------------------------
# STEP 5: Zone Demand Summary
# -------------------------------
zone_avg = df.groupby('zone')['demand'].mean().reset_index()
zone_avg.rename(columns={'demand': 'avg_demand'}, inplace=True)

zone_avg.to_csv("data/zone_demand_summary.csv", index=False)
print("zone_demand_summary.csv created")

# -------------------------------
# STEP 6: Distance Matrix
# -------------------------------
coords = zone_data[['lat','lon']].values
distance_matrix = cdist(coords, coords)

np.save("data/distance_matrix.npy", distance_matrix)
print("distance_matrix.npy created")

# -------------------------------
# STEP 7: High Demand Label
# -------------------------------
zone_avg['high_demand'] = zone_avg['avg_demand'] > 200
zone_avg.to_csv("data/zone_demand_summary.csv", index=False)
print("High demand labels added")

# -------------------------------
# STEP 8: Charging Schedule Dataset
# -------------------------------
schedule_df = df.copy()

schedule_df['recommendation'] = schedule_df['demand'].apply(
    lambda x: 'OFF-PEAK' if x < 150 else 'PEAK'
)

schedule_df.to_csv("data/charging_schedule.csv", index=False)
print("charging_schedule.csv created")

# -------------------------------
# STEP 9: Zone Priority Dataset
# -------------------------------
zone_priority = zone_data.copy()

zone_priority['score'] = (
    zone_priority['ev_density']*0.5 +
    zone_priority['population']*0.3 -
    zone_priority['stations']*0.2
)

zone_priority['priority'] = zone_priority['score'].apply(
    lambda x: 'High' if x > 4000 else 'Medium' if x > 2000 else 'Low'
)

zone_priority.to_csv("data/zone_priority.csv", index=False)
print("zone_priority.csv created")

# -------------------------------
# STEP 10: Coverage Gap Dataset
# -------------------------------
gap_data = []

for i, zone in enumerate(zone_data['zone']):
    if zone_data.loc[i, 'stations'] == 0:
        gap_data.append([zone, "No nearby station"])

gap_df = pd.DataFrame(gap_data, columns=['zone','issue'])
gap_df.to_csv("data/coverage_gaps.csv", index=False)

print("coverage_gaps.csv created")

# -------------------------------
# DONE
# -------------------------------
print("\nAll datasets (basic + advanced) generated successfully!")