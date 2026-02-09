from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.routers import (
    ai_dashboard,
    app_state,
    apuracao_upload,
    cadastro_upload,
    charges,
    chat,
    customers,
    dunning_rules,
    dunning_run,
    dunning_steps,
    franqueadora,
    logs,
    mia,
    simulation,
)

app = FastAPI(title="Cobrança Fácil API", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/api/health")
async def health():
    return {"status": "ok"}


app.include_router(customers.router)
app.include_router(charges.router)
app.include_router(dunning_steps.router)
app.include_router(dunning_rules.router)
app.include_router(dunning_run.router)
app.include_router(logs.router)
app.include_router(franqueadora.router)
app.include_router(app_state.router)
app.include_router(simulation.router)
app.include_router(chat.router)
app.include_router(mia.router)
app.include_router(ai_dashboard.router)
app.include_router(cadastro_upload.router)
app.include_router(apuracao_upload.router)
