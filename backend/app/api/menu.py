"""Menu + tables read APIs (no role gate — terminals need to load instantly)."""
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.schemas import CategoryOut, ProductWithMods, ModGroupOut, ModOptionOut, MenuOut, TableOut
from app.services import get_menu, get_tables

router = APIRouter(prefix="/api", tags=["menu"])


@router.get("/menu", response_model=MenuOut)
def menu(db: Session = Depends(get_db)):
    data = get_menu(db)
    return MenuOut(
        categories=[CategoryOut.model_validate(c) for c in data["categories"]],
        products=[
            ProductWithMods(
                id=p.id, name=p.name, description=p.description, price=p.price,
                category_id=p.category_id, image=p.image, active=p.active,
                modifier_groups=[
                    ModGroupOut(
                        id=g.id, name=g.name, required=g.required, multi=g.multi,
                        options=[ModOptionOut.model_validate(o) for o in g.options],
                    ) for g in p.modifier_groups
                ],
            ) for p in data["products"]
        ],
    )


@router.get("/tables", response_model=list[TableOut])
def tables(db: Session = Depends(get_db)):
    return [TableOut.model_validate(t) for t in get_tables(db)]
