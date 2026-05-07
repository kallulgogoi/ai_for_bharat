# AI for Bharat: EV Infrastructure Dashboard

A sophisticated AI-driven platform for optimizing EV charging infrastructure in urban environments. This project uses PyTorch-based temporal attention models and graph-based optimization (Floyd-Warshall) to predict demand and identify coverage gaps.

## 🚀 Quick Start Instructions:

### Prerequisites
- **Python 3.10+** (Recommended)
- **Node.js 18+**
- **npm** or **yarn**

---

### 1. Backend Setup (AI Engine)
The backend is built with FastAPI and serves the AI predictions and infrastructure analysis.

1. **Navigate to the backend directory**:
   ```bash
   cd aiForBharat/backend
   ```

2. **Create a virtual environment (Optional but Recommended)**:
   ```bash
   python -m venv venv
   source venv/bin/activate  # On Windows: venv\Scripts\activate
   ```

3. **Install Dependencies**:
   ```bash
   pip install fastapi uvicorn torch pandas numpy scikit-learn requests
   ```

4. **Run the Backend Server**:
   ```bash
   python -m uvicorn main:app --reload --port 8000
   ```
   *The AI engine will be available at `http://127.0.0.1:8000`.*

---

### 2. Frontend Setup (Dashboard)
The frontend is a React application built with Vite and Tailwind CSS.

1. **Navigate to the frontend directory**:
   ```bash
   cd aiForBharat/frontend
   ```

2. **Install Dependencies**:
   ```bash
   npm install
   ```

3. **Run the Development Server**:
   ```bash
   npm run dev
   ```
   *The dashboard will be available at `http://localhost:5173`.*

---

## 🛠 Features
- **AI Demand Forecaster**: Uses an RNN-Attention model to predict energy demand for the next 12 hours.
- **Infrastructure Map**: Interactive visualization of zone priorities, coverage gaps, and smart rerouting.
- **Smart Rerouting**: Dynamically shifts traffic from overloaded zones to available charging clusters.
- **Coverage Gap Analysis**: Identifies underserved urban corridors requiring immediate station deployment.

## 📁 Project Structure
- `backend/main.py`: FastAPI server logic and AI model inference.
- `backend/ai_bharat/`: Contains trained model weights (`.pth`) and datasets.
- `frontend/src/pages/`: React components for Dashboard, Map, and Insights.
- `frontend/src/lib/data.js`: API consumption and data normalization layer.
