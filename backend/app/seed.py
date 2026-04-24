"""
seed.py — entry point for database seeding.
Can be called directly or via the dev API endpoint.
"""
from sqlalchemy.orm import Session
from app.services.seed_service import seed_database


TICKET_TEMPLATES = [
    {
        "id": "tpl-leak-3b",
        "name": "Recurring bathroom leak (Unit 3B)",
        "property": "Gartenstraße 42, Berlin",
        "source": "simulated",
        "raised_by": "Herr Meier, Unit 3B",
        "subject": "Bathroom leak is back",
        "body": (
            "The bathroom leak was supposedly fixed last week, but water is dripping again "
            "from the ceiling. Can we tell the tenant someone will come today?"
        ),
    },
    {
        "id": "tpl-heating",
        "name": "Heating outage",
        "property": "Gartenstraße 42, Berlin",
        "source": "simulated",
        "raised_by": "Familie Schmidt, Unit 2A",
        "subject": "No heating since this morning",
        "body": (
            "Our heating has stopped working completely. It is very cold. "
            "We have a small child. Please send someone urgently."
        ),
    },
    {
        "id": "tpl-noise",
        "name": "Noise complaint",
        "property": "Lindenallee 18, Hamburg",
        "source": "simulated",
        "raised_by": "Frau Koch, Unit 2B",
        "subject": "Loud noise from upstairs every night",
        "body": (
            "The tenant in Unit 3B is making excessive noise after 10pm nearly every night. "
            "We have asked them politely but it continues. Please intervene."
        ),
    },
    {
        "id": "tpl-lease",
        "name": "Lease/rent question",
        "property": "Lindenallee 18, Hamburg",
        "source": "simulated",
        "raised_by": "Herr Wagner, Unit 1A",
        "subject": "Question about rent increase notice",
        "body": (
            "I received a rent increase notice but I am not sure if the notice period is legal. "
            "Can you clarify my rights and the legal basis for this increase?"
        ),
    },
    {
        "id": "tpl-payment",
        "name": "Payment delay",
        "property": "Gartenstraße 42, Berlin",
        "source": "simulated",
        "raised_by": "Property Manager",
        "subject": "Unit 1B rent overdue by 12 days",
        "body": (
            "Herr Bauer in Unit 1B has not paid rent for the current month. "
            "It is now 12 days overdue. This is the second time this year. How should we proceed?"
        ),
    },
]


def run_seed(db: Session) -> dict:
    """Run database seeding. Called from dev routes or startup."""
    return seed_database(db)
