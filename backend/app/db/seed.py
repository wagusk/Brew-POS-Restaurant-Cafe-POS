"""Seed a cafe menu + 3 users + 8 tables. Re-runnable: idempotent on PIN."""
from __future__ import annotations
from app.db.session import Base, current_engine, SessionLocal
from app.models import User, Category, Product, ModifierGroup, ModifierOption, Table
from app.core.security import hash_pin


SEED_USERS = [
    ("Admin", "9999", "admin"),
    ("Cashier", "1111", "cashier"),
    ("Waiter", "2222", "waiter"),
    ("Kitchen", "3333", "kitchen"),
]


SEED_CATEGORIES = [
    # name, icon, color, sort, kind
    ("Coffee", "local_cafe", "#8B5A2B", 0, "bar"),
    ("Tea", "emoji_food_beverage", "#2E7D32", 1, "bar"),
    ("Pastries", "bakery_dining", "#D17A22", 2, "kitchen"),
    ("Sandwiches", "lunch_dining", "#5B8DEF", 3, "kitchen"),
    ("Cold Drinks", "local_bar", "#9C27B0", 4, "bar"),
    ("Desserts", "icecream", "#E91E63", 5, "kitchen"),
]


SEED_PRODUCTS = [
    # (cat_name, name, price, desc, mods)
    ("Coffee", "Espresso", 2.50, "Single shot", [("Shot", True, [("Single", 0), ("Double", 0.50)]), ("Milk", False, [("Regular", 0), ("Oat", 0.70), ("Almond", 0.70)])]),
    ("Coffee", "Cappuccino", 3.50, "Espresso + steamed milk", [("Milk", False, [("Regular", 0), ("Oat", 0.70)])]),
    ("Coffee", "Latte", 3.75, "Smooth & milky", [("Milk", False, [("Regular", 0), ("Oat", 0.70)])]),
    ("Coffee", "Americano", 3.00, "Espresso + hot water", []),
    ("Coffee", "Mocha", 4.25, "Chocolate + espresso", [("Milk", False, [("Regular", 0), ("Oat", 0.70)])]),
    ("Tea", "English Breakfast", 2.75, "Bold black tea", []),
    ("Tea", "Earl Grey", 2.75, "Bergamot black tea", []),
    ("Tea", "Green Tea", 2.75, "Light & grassy", []),
    ("Tea", "Chai Latte", 4.00, "Spiced & steamed", [("Milk", False, [("Regular", 0), ("Oat", 0.70)])]),
    ("Tea", "Matcha Latte", 4.50, "Ceremonial-grade matcha", [("Milk", False, [("Regular", 0), ("Oat", 0.70)])]),
    ("Pastries", "Croissant", 3.00, "Butter, flaky", []),
    ("Pastries", "Pain au Chocolat", 3.50, "Chocolate-filled", []),
    ("Pastries", "Blueberry Muffin", 3.25, "Bursting with berries", []),
    ("Pastries", "Cinnamon Roll", 3.75, "With cream cheese glaze", []),
    ("Sandwiches", "Ham & Cheese", 6.50, "On sourdough", [("Bread", True, [("Sourdough", 0), ("Whole Wheat", 0), ("Gluten Free", 1.00)])]),
    ("Sandwiches", "Caprese", 7.00, "Mozzarella, tomato, basil", [("Bread", True, [("Sourdough", 0), ("Whole Wheat", 0)])]),
    ("Sandwiches", "Avocado Toast", 6.75, "Sourdough + smashed avo", [("Extras", False, [("Egg", 1.50), ("Feta", 1.00), ("Chili", 0.00)])]),
    ("Sandwiches", "BLT", 6.95, "Bacon, lettuce, tomato", [("Bread", True, [("Sourdough", 0), ("Whole Wheat", 0)])]),
    ("Cold Drinks", "Iced Coffee", 3.75, "Cold-brewed", [("Milk", False, [("Regular", 0), ("Oat", 0.70)])]),
    ("Cold Drinks", "Lemonade", 3.25, "Fresh-squeezed", []),
    ("Cold Drinks", "Iced Tea", 3.25, "Peach", []),
    ("Cold Drinks", "Sparkling Water", 2.50, "500ml", []),
    ("Desserts", "Chocolate Cake", 5.50, "Triple-layer", []),
    ("Desserts", "Cheesecake", 5.75, "New York style", []),
    ("Desserts", "Tiramisu", 5.95, "Classic Italian", []),
    ("Desserts", "Cookie", 2.25, "Chocolate chip", []),
]


SEED_TABLES = [(f"T{i}", 4) for i in range(1, 9)]


def run():
    Base.metadata.create_all(bind=current_engine())
    db = SessionLocal()
    try:
        # Users
        for name, pin, role in SEED_USERS:
            existing = db.query(User).filter(User.name == name).first()
            if existing:
                existing.pin = hash_pin(pin)
                existing.role = role
                existing.active = True
            else:
                db.add(User(name=name, pin=hash_pin(pin), role=role, active=True))

        # Categories
        cat_index: dict[str, Category] = {}
        for name, icon, color, sort, kind in SEED_CATEGORIES:
            c = db.query(Category).filter(Category.name == name).first()
            if not c:
                c = Category(name=name, icon=icon, color=color, sort=sort, kind=kind)
                db.add(c)
                db.flush()
            elif c.kind != kind:
                # Backfill the station assignment on existing seeded categories
                # so a re-seed picks up the new kitchen/bar split.
                c.kind = kind
            cat_index[name] = c

        # Products + modifier groups
        for cat_name, pname, price, desc, mods in SEED_PRODUCTS:
            p = db.query(Product).filter(Product.name == pname, Product.category_id == cat_index[cat_name].id).first()
            if not p:
                p = Product(name=pname, price=price, description=desc, category_id=cat_index[cat_name].id)
                db.add(p)
                db.flush()
            for mname, required, options in mods:
                mg = db.query(ModifierGroup).filter(ModifierGroup.product_id == p.id, ModifierGroup.name == mname).first()
                if not mg:
                    mg = ModifierGroup(name=mname, required=required, multi=not required, product_id=p.id)
                    db.add(mg)
                    db.flush()
                for oname, delta in options:
                    if not db.query(ModifierOption).filter(ModifierOption.group_id == mg.id, ModifierOption.name == oname).first():
                        db.add(ModifierOption(name=oname, price_delta=delta, group_id=mg.id))

        # Tables
        for tname, seats in SEED_TABLES:
            if not db.query(Table).filter(Table.name == tname).first():
                db.add(Table(name=tname, seats=seats))

        db.commit()
        print(f"Seeded: {len(SEED_USERS)} users, {len(SEED_CATEGORIES)} categories, "
              f"{len(SEED_PRODUCTS)} products, {len(SEED_TABLES)} tables.")
        print("Login PINs: admin=9999, cashier=1111, waiter=2222, kitchen=3333")
    finally:
        db.close()


if __name__ == "__main__":
    run()
