echo "Starting backend..."
Start-Process powershell -ArgumentList "-NoExit -Command `"cd backend; .\venv\Scripts\activate; uvicorn main:app --reload`""

echo "Starting frontend..."
Start-Process powershell -ArgumentList "-NoExit -Command `"cd frontend; npm run dev`""
