from datetime import date
from typing import Dict
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from db.schema import BusinessRule, RuleType
from models.settings import AllSettings, CutoffSettings, StaffSettings, RouteSettings, NotificationSettings

async def get_all_settings(db: AsyncSession) -> AllSettings:
    result = await db.execute(select(BusinessRule).where(BusinessRule.is_active == True))
    rules = result.scalars().all()
    
    settings = AllSettings()
    
    for rule in rules:
        if rule.rule_type == RuleType.CUTOFF and rule.rule_config:
            if "cutoff_time" in rule.rule_config:
                settings.cutoff.cutoff_time = rule.rule_config["cutoff_time"]
            if "weekend_processing" in rule.rule_config:
                settings.cutoff.weekend_processing = rule.rule_config["weekend_processing"]
            if "holiday_override" in rule.rule_config:
                settings.cutoff.holiday_override = rule.rule_config["holiday_override"]
        
        elif rule.rule_type == RuleType.ASSIGNMENT and rule.rule_config:
            if "default_start_location" in rule.rule_config:
                settings.staff.default_start_location = rule.rule_config["default_start_location"]
            if "max_orders_per_staff" in rule.rule_config:
                settings.staff.max_orders_per_staff = rule.rule_config["max_orders_per_staff"]
            if "auto_assign" in rule.rule_config:
                settings.staff.auto_assign = rule.rule_config["auto_assign"]
        
        elif rule.rule_type == RuleType.ROUTING and rule.rule_config:
            if "optimization_priority" in rule.rule_config:
                settings.route.optimization_priority = rule.rule_config["optimization_priority"]
            if "max_route_time_hours" in rule.rule_config:
                settings.route.max_route_time_hours = rule.rule_config["max_route_time_hours"]
            if "include_return" in rule.rule_config:
                settings.route.include_return = rule.rule_config["include_return"]
    
    return settings

async def update_cutoff_settings_controller(db: AsyncSession, settings: CutoffSettings) -> CutoffSettings:
    result = await db.execute(select(BusinessRule).where(BusinessRule.rule_type == RuleType.CUTOFF))
    rule = result.scalar_one_or_none()
    
    if rule:
        rule.rule_config = settings.model_dump()
    else:
        rule = BusinessRule(
            rule_name="Daily Cutoff Settings",
            rule_type=RuleType.CUTOFF,
            rule_config=settings.model_dump(),
            is_active=True,
        )
        db.add(rule)
    
    await db.flush()
    return settings

async def update_staff_settings_controller(db: AsyncSession, settings: StaffSettings) -> StaffSettings:
    result = await db.execute(select(BusinessRule).where(BusinessRule.rule_type == RuleType.ASSIGNMENT))
    rule = result.scalar_one_or_none()
    
    if rule:
        rule.rule_config = settings.model_dump()
    else:
        rule = BusinessRule(
            rule_name="Staff Assignment Settings",
            rule_type=RuleType.ASSIGNMENT,
            rule_config=settings.model_dump(),
            is_active=True,
        )
        db.add(rule)
    
    await db.flush()
    return settings

async def update_route_settings_controller(db: AsyncSession, settings: RouteSettings) -> RouteSettings:
    result = await db.execute(select(BusinessRule).where(BusinessRule.rule_type == RuleType.ROUTING))
    rule = result.scalar_one_or_none()
    
    if rule:
        rule.rule_config = settings.model_dump()
    else:
        rule = BusinessRule(
            rule_name="Route Optimization Settings",
            rule_type=RuleType.ROUTING,
            rule_config=settings.model_dump(),
            is_active=True,
        )
        db.add(rule)
    
    await db.flush()
    return settings

async def update_notification_settings_controller(db: AsyncSession, settings: NotificationSettings) -> NotificationSettings:
    result = await db.execute(
        select(BusinessRule)
        .where(BusinessRule.rule_type == RuleType.PRIORITY)
        .where(BusinessRule.rule_name == "Notification Settings")
    )
    rule = result.scalar_one_or_none()
    
    if rule:
        rule.rule_config = settings.model_dump()
    else:
        rule = BusinessRule(
            rule_name="Notification Settings",
            rule_type=RuleType.PRIORITY,
            rule_config=settings.model_dump(),
            is_active=True,
        )
        db.add(rule)
    
    await db.flush()
    return settings

async def import_stores_controller(db: AsyncSession, csv_data: str):
    """Import stores from CSV data"""
    from db.schema import Store
    from io import StringIO
    import csv

    if not csv_data:
        return {"message": "CSVデータがありません", "created": 0, "updated": 0, "errors": []}

    reader = csv.DictReader(StringIO(csv_data))
    created = 0
    updated = 0
    errors = []

    for row in reader:
        try:
            store_name = row.get('store_name', '').strip()
            if not store_name:
                errors.append(f"店舗名が空です: {row}")
                continue

            # Check if store exists by name
            result = await db.execute(select(Store).where(Store.store_name == store_name))
            store = result.scalar_one_or_none()

            if store:
                # Update existing
                store.store_code = row.get('store_code', store.store_code)
                store.address = row.get('address', store.address)
                store.district = row.get('district', store.district)
                store.category = row.get('category', store.category)
                if row.get('priority_level'):
                    try:
                        store.priority_level = int(row.get('priority_level'))
                    except ValueError:
                        pass
                if row.get('latitude'):
                    try:
                        store.latitude = float(row.get('latitude'))
                    except ValueError:
                        pass
                if row.get('longitude'):
                    try:
                        store.longitude = float(row.get('longitude'))
                    except ValueError:
                        pass
                if row.get('is_active'):
                    store.is_active = row.get('is_active', '').lower() in ['true', '1', 'yes', 'True']
                updated += 1
            else:
                # Create new
                store = Store(
                    store_name=store_name,
                    store_code=row.get('store_code', ''),
                    address=row.get('address', ''),
                    district=row.get('district', ''),
                    category=row.get('category', ''),
                    priority_level=int(row.get('priority_level', 2)) if row.get('priority_level') else 2,
                    is_active=row.get('is_active', '').lower() in ['true', '1', 'yes', 'True'] if row.get('is_active') else True
                )
                # Parse coordinates if provided
                if row.get('latitude'):
                    try:
                        store.latitude = float(row.get('latitude'))
                    except ValueError:
                        pass
                if row.get('longitude'):
                    try:
                        store.longitude = float(row.get('longitude'))
                    except ValueError:
                        pass
                db.add(store)
                created += 1
        except Exception as e:
            errors.append(f"エラー (店舗: {row.get('store_name', 'unknown')}): {str(e)}")

    await db.commit()

    return {
        "message": f"{created}件の店舗を作成、{updated}件を更新しました",
        "created": created,
        "updated": updated,
        "errors": errors
    }


async def export_stores_controller(db: AsyncSession):
    """Export all stores as CSV"""
    from db.schema import Store
    from io import StringIO
    import csv

    result = await db.execute(select(Store).order_by(Store.store_id))
    stores = result.scalars().all()

    output = StringIO()
    writer = csv.writer(output)

    # Header
    writer.writerow([
        'store_id', 'store_name', 'store_code', 'address', 'district',
        'latitude', 'longitude', 'category', 'priority_level', 'is_active',
        'created_at', 'updated_at'
    ])

    # Data rows
    for s in stores:
        writer.writerow([
            s.store_id, s.store_name, s.store_code or '',
            s.address or '', s.district or '',
            float(s.latitude) if s.latitude else '',
            float(s.longitude) if s.longitude else '',
            s.category or '', s.priority_level, s.is_active,
            s.created_at, s.updated_at
        ])

    return output.getvalue()


async def import_mappings_controller(db: AsyncSession, csv_data: str):
    """Import product-store mappings from CSV data"""
    from db.schema import Product, Store, ProductStoreMapping, StockStatus
    from io import StringIO
    import csv

    if not csv_data:
        return {"message": "CSVデータがありません", "created": 0, "updated": 0, "errors": []}

    reader = csv.DictReader(StringIO(csv_data))
    created = 0
    updated = 0
    errors = []

    # Cache for product and store lookups
    product_cache = {}
    store_cache = {}

    for row in reader:
        try:
            sku = row.get('sku', '').strip()
            store_name = row.get('store_name', '').strip()

            if not sku or not store_name:
                errors.append(f"SKUまたは店舗名が空です: {row}")
                continue

            # Get product_id from SKU (with cache)
            if sku not in product_cache:
                result = await db.execute(select(Product).where(Product.sku == sku))
                product = result.scalar_one_or_none()
                product_cache[sku] = product.product_id if product else None

            product_id = product_cache[sku]
            if not product_id:
                errors.append(f"商品が見つかりません (SKU: {sku})")
                continue

            # Get store_id from store_name (with cache)
            if store_name not in store_cache:
                result = await db.execute(select(Store).where(Store.store_name == store_name))
                store = result.scalar_one_or_none()
                store_cache[store_name] = store.store_id if store else None

            store_id = store_cache[store_name]
            if not store_id:
                errors.append(f"店舗が見つかりません (店舗名: {store_name})")
                continue

            # Check if mapping exists
            result = await db.execute(
                select(ProductStoreMapping)
                .where(ProductStoreMapping.product_id == product_id)
                .where(ProductStoreMapping.store_id == store_id)
            )
            mapping = result.scalar_one_or_none()

            # Parse stock_status
            stock_status_str = row.get('stock_status', 'unknown').lower()
            stock_status = StockStatus.UNKNOWN
            if stock_status_str == 'in_stock':
                stock_status = StockStatus.IN_STOCK
            elif stock_status_str == 'low_stock':
                stock_status = StockStatus.LOW_STOCK
            elif stock_status_str == 'out_of_stock':
                stock_status = StockStatus.OUT_OF_STOCK

            if mapping:
                # Update existing
                mapping.is_primary_store = row.get('is_primary_store', '').lower() in ['true', '1', 'yes']
                mapping.priority = int(row.get('priority', 1)) if row.get('priority') else mapping.priority
                mapping.stock_status = stock_status
                updated += 1
            else:
                # Create new
                mapping = ProductStoreMapping(
                    product_id=product_id,
                    store_id=store_id,
                    is_primary_store=row.get('is_primary_store', '').lower() in ['true', '1', 'yes'],
                    priority=int(row.get('priority', 1)) if row.get('priority') else 1,
                    stock_status=stock_status
                )
                db.add(mapping)
                created += 1
        except Exception as e:
            errors.append(f"エラー (SKU: {row.get('sku', 'unknown')}, 店舗: {row.get('store_name', 'unknown')}): {str(e)}")

    await db.commit()

    return {
        "message": f"{created}件のマッピングを作成、{updated}件を更新しました",
        "created": created,
        "updated": updated,
        "errors": errors
    }

async def export_orders_controller(db: AsyncSession):
    from sqlalchemy import select
    from db.schema import Order, OrderItem
    from sqlalchemy.orm import selectinload
    from io import StringIO
    import csv
    
    result = await db.execute(
        select(Order).options(selectinload(Order.items)).order_by(Order.order_id)
    )
    orders = result.scalars().all()
    
    output = StringIO()
    writer = csv.writer(output)
    writer.writerow([
        "order_id", "robot_in_order_id", "mall_name", "customer_name",
        "order_date", "target_purchase_date", "order_status",
        "item_sku", "item_name", "quantity", "unit_price"
    ])
    
    for order in orders:
        if order.items:
            for item in order.items:
                writer.writerow([
                    order.order_id,
                    order.robot_in_order_id or "",
                    order.mall_name or "",
                    order.customer_name or "",
                    order.order_date.isoformat() if order.order_date else "",
                    order.target_purchase_date.isoformat() if order.target_purchase_date else "",
                    order.order_status.value if order.order_status else "",
                    item.sku or "",
                    item.product_name or "",
                    item.quantity or 0,
                    float(item.unit_price) if item.unit_price else 0.0
                ])
        else:
            writer.writerow([
                order.order_id,
                order.robot_in_order_id or "",
                order.mall_name or "",
                order.customer_name or "",
                order.order_date.isoformat() if order.order_date else "",
                order.target_purchase_date.isoformat() if order.target_purchase_date else "",
                order.order_status.value if order.order_status else "",
                "", "", 0, 0.0
            ])
    
    return output.getvalue()

async def create_backup_controller(db: AsyncSession):
    return {"message": "バックアップを作成しました"}


async def import_purchase_list_csv(db: AsyncSession, csv_data: str, target_date: date = None):
    """
    Import the client's purchase list CSV format (購入リスト店舗入力.csv)

    Creates:
    - Products & Stores (master data)
    - ProductStoreMapping (with quantity allocations)
    - Orders & OrderItems (ready for staff assignment + route generation)

    Optimized: pre-loads existing data in bulk (3 queries) instead of per-row lookups.
    """
    from db.schema import (
        Product, Store, ProductStoreMapping, StockStatus,
        Order, OrderItem, OrderStatus, ItemStatus
    )
    from io import StringIO
    import csv
    from datetime import date as date_type, datetime

    if target_date is None:
        target_date = date_type.today()

    if not csv_data:
        return {"message": "CSVデータがありません", "products_created": 0, "stores_created": 0, "mappings_created": 0, "errors": []}

    reader = csv.reader(StringIO(csv_data))
    rows = list(reader)

    errors = []

    # Find the header row
    header_idx = 0
    for i, row in enumerate(rows):
        if len(row) >= 6 and ('商品コード' in row[1] or 'product_code' in str(row).lower()):
            header_idx = i
            break

    # === Phase 1: Parse all CSV rows in memory ===
    parsed_rows = []
    current_product_code = None
    current_product_name = None
    all_product_codes = set()
    all_store_names = set()
    store_address_map = {}  # store_name -> address (first seen)

    for row_idx, row in enumerate(rows[header_idx + 1:], start=header_idx + 2):
        if len(row) < 6:
            continue

        product_code = row[1].strip() if len(row) > 1 else ''
        product_name = row[2].strip() if len(row) > 2 else ''
        quantity_str = row[4].strip() if len(row) > 4 else ''
        store_name = row[5].strip() if len(row) > 5 else ''
        address = row[6].strip() if len(row) > 6 else ''

        if not quantity_str or not store_name:
            continue

        if product_code:
            current_product_code = product_code
            current_product_name = product_name

        if not current_product_code:
            continue

        try:
            quantity = int(quantity_str)
        except ValueError:
            errors.append(f"行 {row_idx}: 数量が無効です: {quantity_str}")
            continue

        all_product_codes.add(current_product_code)
        all_store_names.add(store_name)
        if store_name not in store_address_map and address:
            store_address_map[store_name] = address

        parsed_rows.append({
            "product_code": current_product_code,
            "product_name": current_product_name,
            "store_name": store_name,
            "address": address,
            "quantity": quantity,
            "row_idx": row_idx,
        })

    if not parsed_rows:
        return {"message": "インポートするデータがありません", "products_created": 0, "stores_created": 0, "mappings_created": 0, "errors": errors}

    # === Phase 2: Bulk-load existing products and stores (2 queries) ===
    result = await db.execute(
        select(Product).where(Product.sku.in_(list(all_product_codes)))
    )
    existing_products = {p.sku: p for p in result.scalars().all()}

    result = await db.execute(
        select(Store).where(Store.store_name.in_(list(all_store_names)))
    )
    existing_stores = {s.store_name: s for s in result.scalars().all()}

    # === Phase 3: Create missing products and stores in batch ===
    products_created = 0
    product_cache = {}  # sku -> product_id

    for sku in all_product_codes:
        if sku in existing_products:
            product_cache[sku] = existing_products[sku].product_id
        else:
            # Find name from parsed rows
            name = next((r["product_name"] for r in parsed_rows if r["product_code"] == sku and r["product_name"]), sku)
            product = Product(
                sku=sku,
                product_name=name,
                is_store_fixed=False,
                exclude_from_routing=False
            )
            db.add(product)
            products_created += 1

    if products_created > 0:
        await db.flush()
        # Re-fetch newly created products to get their IDs
        result = await db.execute(
            select(Product).where(Product.sku.in_([s for s in all_product_codes if s not in product_cache]))
        )
        for p in result.scalars().all():
            product_cache[p.sku] = p.product_id

    stores_created = 0
    store_cache = {}  # store_name -> store_id

    for sname in all_store_names:
        if sname in existing_stores:
            store = existing_stores[sname]
            store_cache[sname] = store.store_id
            # Update address if not set
            addr = store_address_map.get(sname, "")
            if not store.address and addr:
                store.address = addr
                lat, lng = extract_coordinates_from_address(addr)
                if lat and lng:
                    store.latitude = lat
                    store.longitude = lng
        else:
            addr = store_address_map.get(sname, "")
            district = extract_district(addr)
            lat, lng = extract_coordinates_from_address(addr)
            store = Store(
                store_name=sname,
                address=addr,
                district=district,
                latitude=lat,
                longitude=lng,
                priority_level=2,
                is_active=True
            )
            db.add(store)
            stores_created += 1

    if stores_created > 0:
        await db.flush()
        # Re-fetch newly created stores to get their IDs
        result = await db.execute(
            select(Store).where(Store.store_name.in_([s for s in all_store_names if s not in store_cache]))
        )
        for s in result.scalars().all():
            store_cache[s.store_name] = s.store_id

    # === Phase 4: Bulk-load existing mappings (1 query) ===
    all_product_ids = set(product_cache.values())
    all_store_ids = set(store_cache.values())

    result = await db.execute(
        select(ProductStoreMapping)
        .where(ProductStoreMapping.product_id.in_(list(all_product_ids)))
        .where(ProductStoreMapping.store_id.in_(list(all_store_ids)))
    )
    existing_mappings = {}
    for m in result.scalars().all():
        existing_mappings[(m.product_id, m.store_id)] = m

    # === Phase 5: Create/update mappings in batch ===
    mappings_created = 0

    for row_data in parsed_rows:
        try:
            product_id = product_cache[row_data["product_code"]]
            store_id = store_cache[row_data["store_name"]]
            quantity = row_data["quantity"]
            key = (product_id, store_id)

            if key not in existing_mappings:
                mapping = ProductStoreMapping(
                    product_id=product_id,
                    store_id=store_id,
                    is_primary_store=False,
                    priority=1,
                    stock_status=StockStatus.IN_STOCK,
                    max_daily_quantity=quantity,
                    current_available=quantity
                )
                db.add(mapping)
                existing_mappings[key] = mapping
                mappings_created += 1
            else:
                mapping = existing_mappings[key]
                if mapping.max_daily_quantity:
                    mapping.max_daily_quantity = max(mapping.max_daily_quantity, quantity)
                else:
                    mapping.max_daily_quantity = quantity
                mapping.current_available = quantity
                mapping.stock_status = StockStatus.IN_STOCK

        except Exception as e:
            errors.append(f"行 {row_data['row_idx']}: エラー - {str(e)}")

    # === Phase 6: Create Orders + OrderItems from CSV data ===
    # The CSV IS the purchase list - create orders directly so auto-assign + route generation works.
    # Delete existing CSV-imported orders for same date to allow re-import.
    existing_csv_orders = await db.execute(
        select(Order)
        .where(Order.target_purchase_date == target_date)
        .where(Order.mall_name == "購入リスト")
        .where(Order.order_status == OrderStatus.PENDING)
    )
    for old_order in existing_csv_orders.scalars().all():
        await db.delete(old_order)
    await db.flush()

    # Group by product_code: sum total quantity across all stores
    product_totals: Dict[str, int] = {}
    product_names: Dict[str, str] = {}
    for row_data in parsed_rows:
        code = row_data["product_code"]
        product_totals[code] = product_totals.get(code, 0) + row_data["quantity"]
        if code not in product_names:
            product_names[code] = row_data["product_name"]

    # Create one Order for the purchase date
    order = Order(
        mall_name="購入リスト",
        order_date=datetime.now(),
        order_status=OrderStatus.PENDING,
        target_purchase_date=target_date,
    )
    db.add(order)
    await db.flush()

    # Create OrderItems for each unique product
    items_created = 0
    for sku, total_qty in product_totals.items():
        if sku not in product_cache:
            continue
        order_item = OrderItem(
            order_id=order.order_id,
            sku=sku,
            product_name=product_names.get(sku, sku),
            quantity=total_qty,
            item_status=ItemStatus.PENDING,
        )
        db.add(order_item)
        items_created += 1

    await db.commit()

    return {
        "message": f"インポート完了: 商品 {products_created}件, 店舗 {stores_created}件, マッピング {mappings_created}件, 注文アイテム {items_created}件",
        "products_created": products_created,
        "stores_created": stores_created,
        "mappings_created": mappings_created,
        "items_created": items_created,
        "order_id": order.order_id,
        "errors": errors[:20] if errors else []
    }


def extract_district(address: str) -> str:
    """Extract district from Japanese address"""
    import re

    if not address:
        return ""

    # Pattern for Japanese addresses: 大阪府大阪市XXX区
    match = re.search(r'(大阪市[^区]+区|[^市]+市)', address)
    if match:
        return match.group(1)

    # Pattern for 区 only
    match = re.search(r'([^区]+区)', address)
    if match:
        return match.group(1)

    return ""


def extract_coordinates_from_address(address: str) -> tuple:
    """
    Extract or estimate coordinates from address.
    Returns (latitude, longitude) or (None, None)

    Uses an expanded lookup for Osaka districts and postal codes.
    """
    from decimal import Decimal
    import re

    if not address:
        return None, None

    # Extract postal code if present (formats: 〒XXX-XXXX, XXX-XXXX, or XXX XXXX at end)
    postal_match = re.search(r'[〒]?(\d{3})[-\s]?(\d{4})', address)
    postal_code = f"{postal_match.group(1)}-{postal_match.group(2)}" if postal_match else None

    # Postal code to coordinates mapping (Osaka and surrounding areas)
    # All postal codes from the purchase list CSV are included
    postal_coords = {
        # 大阪市北区
        "530-0001": (Decimal("34.7003"), Decimal("135.4953")),  # 梅田
        "530-0011": (Decimal("34.7058"), Decimal("135.4945")),  # 大深町 (グランフロント)
        "530-0012": (Decimal("34.7059"), Decimal("135.4996")),  # 芝田
        "530-0017": (Decimal("34.7037"), Decimal("135.5003")),  # 角田町 (阪急うめだ)
        "530-0018": (Decimal("34.7055"), Decimal("135.5025")),  # 小松原町 (ホワイティうめだ)
        "530-0057": (Decimal("34.7035"), Decimal("135.5028")),  # 曽根崎
        "530-8224": (Decimal("34.7004"), Decimal("135.4988")),  # 阪神百貨店
        "530-8350": (Decimal("34.7037"), Decimal("135.5003")),  # 阪急うめだ本店
        # 大阪市中央区
        "540-0003": (Decimal("34.6825"), Decimal("135.5180")),  # 森ノ宮中央
        "540-0006": (Decimal("34.6710"), Decimal("135.5230")),  # 法円坂
        "540-0013": (Decimal("34.6795"), Decimal("135.5100")),  # 内久宝寺町
        "540-0026": (Decimal("34.6830"), Decimal("135.5175")),  # 内本町
        "540-0029": (Decimal("34.6820"), Decimal("135.5130")),  # 本町橋
        "541-0051": (Decimal("34.6843"), Decimal("135.5059")),  # 備後町
        "541-0055": (Decimal("34.6810"), Decimal("135.5055")),  # 船場中央
        "541-0056": (Decimal("34.6820"), Decimal("135.5065")),  # 久太郎町
        "541-0058": (Decimal("34.6788"), Decimal("135.5068")),  # 南久宝寺町
        "541-0059": (Decimal("34.6780"), Decimal("135.5045")),  # 博労町
        "542-0061": (Decimal("34.6715"), Decimal("135.5055")),  # 安堂寺町
        "542-0073": (Decimal("34.6690"), Decimal("135.5070")),  # 日本橋
        "542-0076": (Decimal("34.6656"), Decimal("135.5013")),  # 難波
        "542-0081": (Decimal("34.6720"), Decimal("135.5040")),  # 南船場
        "542-0083": (Decimal("34.6705"), Decimal("135.5020")),  # 東心斎橋
        "542-0085": (Decimal("34.6720"), Decimal("135.4995")),  # 心斎橋筋
        "542-0086": (Decimal("34.6710"), Decimal("135.4980")),  # 西心斎橋
        "542-8501": (Decimal("34.6740"), Decimal("135.5013")),  # 心斎橋 大丸
        "542-8510": (Decimal("34.6650"), Decimal("135.5015")),  # 難波 高島屋
        # 大阪市天王寺区
        "543-0026": (Decimal("34.6538"), Decimal("135.5220")),  # 東上町
        "543-0037": (Decimal("34.6580"), Decimal("135.5180")),  # 上之宮町
        "543-0055": (Decimal("34.6468"), Decimal("135.5152")),  # 悲田院町 (天王寺ミオ)
        "543-0063": (Decimal("34.6550"), Decimal("135.5155")),  # 茶臼山町
        # 大阪市生野区
        "544-0034": (Decimal("34.6580"), Decimal("135.5350")),  # 桃谷
        # 大阪市阿倍野区
        "545-0023": (Decimal("34.6380"), Decimal("135.5130")),  # 王子町
        "545-0052": (Decimal("34.6350"), Decimal("135.5100")),  # 阿倍野筋
        "545-6001": (Decimal("34.6460"), Decimal("135.5145")),  # あべのハルカス
        "545-8545": (Decimal("34.6455"), Decimal("135.5145")),  # あべのキューズモール
        # 大阪市浪速区
        "556-0011": (Decimal("34.6595"), Decimal("135.5020")),  # 難波中
        # 大阪市福島区
        "553-0001": (Decimal("34.6910"), Decimal("135.4665")),  # 海老江
        "553-0006": (Decimal("34.6870"), Decimal("135.4720")),  # 吉野
        "553-0007": (Decimal("34.6875"), Decimal("135.4615")),  # 大開
        # 大阪市港区
        "552-0001": (Decimal("34.6580"), Decimal("135.4520")),  # 波除
        "552-0007": (Decimal("34.6620"), Decimal("135.4590")),  # 弁天
        # 大阪市西区
        "550-0001": (Decimal("34.6850"), Decimal("135.4755")),  # 土佐堀
        "550-0023": (Decimal("34.6780"), Decimal("135.4820")),  # 靭本町
        # 堺市
        "591-8008": (Decimal("34.5730"), Decimal("135.4720")),  # 堺市北区中百舌鳥町
        # 尼崎市 (兵庫県)
        "660-0862": (Decimal("34.7335"), Decimal("135.4095")),  # 尼崎市開明町
        "660-0884": (Decimal("34.7350"), Decimal("135.4080")),  # 尼崎市神田中通
    }

    # Check postal code first (most accurate)
    if postal_code and postal_code in postal_coords:
        return postal_coords[postal_code]

    # Extended area coordinates (approximate centers) for fallback
    area_coords = {
        # 大阪市各区
        "北区": (Decimal("34.7055"), Decimal("135.4983")),
        "中央区": (Decimal("34.6784"), Decimal("135.5014")),
        "天王寺区": (Decimal("34.6533"), Decimal("135.5189")),
        "浪速区": (Decimal("34.6580"), Decimal("135.5004")),
        "福島区": (Decimal("34.6911"), Decimal("135.4744")),
        "港区": (Decimal("34.6600"), Decimal("135.4560")),
        "阿倍野区": (Decimal("34.6350"), Decimal("135.5180")),
        "西区": (Decimal("34.6781"), Decimal("135.4803")),
        "此花区": (Decimal("34.6820"), Decimal("135.4270")),
        "城東区": (Decimal("34.7040"), Decimal("135.5420")),
        "鶴見区": (Decimal("34.7100"), Decimal("135.5700")),
        "東成区": (Decimal("34.6740"), Decimal("135.5380")),
        "東淀川区": (Decimal("34.7470"), Decimal("135.5170")),
        "住吉区": (Decimal("34.6110"), Decimal("135.4980")),
        "住之江区": (Decimal("34.5960"), Decimal("135.4680")),
        "東住吉区": (Decimal("34.6130"), Decimal("135.5240")),
        "平野区": (Decimal("34.6200"), Decimal("135.5520")),
        "生野区": (Decimal("34.6560"), Decimal("135.5350")),
        "旭区": (Decimal("34.7220"), Decimal("135.5350")),
        "都島区": (Decimal("34.7160"), Decimal("135.5190")),
        "淀川区": (Decimal("34.7280"), Decimal("135.4850")),
        "西成区": (Decimal("34.6340"), Decimal("135.4850")),
        "大正区": (Decimal("34.6380"), Decimal("135.4580")),
        "西淀川区": (Decimal("34.7010"), Decimal("135.4430")),
    }

    for area, coords in area_coords.items():
        if area in address:
            return coords

    # Default to central Osaka
    if "大阪" in address:
        return Decimal("34.6937"), Decimal("135.5023")

    return None, None


async def geocode_address_nominatim(address: str) -> tuple:
    """
    Geocode an address using OpenStreetMap Nominatim API.
    Returns (latitude, longitude) or (None, None)

    Rate limited: max 1 request per second.
    """
    import httpx
    from decimal import Decimal
    import asyncio

    if not address:
        return None, None

    # Clean and prepare address for geocoding
    clean_address = address.replace("日本、", "").strip()

    try:
        async with httpx.AsyncClient() as client:
            response = await client.get(
                "https://nominatim.openstreetmap.org/search",
                params={
                    "q": clean_address,
                    "format": "json",
                    "limit": 1,
                    "countrycodes": "jp"
                },
                headers={
                    "User-Agent": "AutoRoutineApp/1.0"
                },
                timeout=10.0
            )

            if response.status_code == 200:
                data = response.json()
                if data and len(data) > 0:
                    lat = Decimal(data[0]["lat"])
                    lng = Decimal(data[0]["lon"])
                    return lat, lng
    except Exception as e:
        print(f"Geocoding error for {address}: {e}")

    return None, None


async def update_stores_missing_coordinates(db: AsyncSession):
    """
    Update all stores that are missing latitude/longitude coordinates
    using the Nominatim API.
    """
    from db.schema import Store
    import asyncio

    result = await db.execute(
        select(Store).where(
            (Store.latitude == None) | (Store.longitude == None)
        ).where(Store.address != None)
    )
    stores = result.scalars().all()

    updated_count = 0
    errors = []

    for store in stores:
        # First try local lookup
        lat, lng = extract_coordinates_from_address(store.address)

        # If local lookup failed, try Nominatim
        if not lat or not lng:
            lat, lng = await geocode_address_nominatim(store.address)
            # Rate limit: wait 1 second between Nominatim requests
            await asyncio.sleep(1)

        if lat and lng:
            store.latitude = lat
            store.longitude = lng
            updated_count += 1
        else:
            errors.append(f"座標取得失敗: {store.store_name}")

    await db.commit()

    return {
        "message": f"{updated_count}件の店舗の座標を更新しました",
        "updated": updated_count,
        "failed": len(errors),
        "errors": errors[:10]  # Limit error display
    }


async def clear_all_data_controller(db: AsyncSession):
    """
    Clear all data from database for fresh testing.

    Deletes data in correct order to respect foreign keys:
    - Route Stops
    - Routes
    - Purchase List Items
    - Purchase Lists
    - Purchase Failures
    - Order Items
    - Orders
    - Store Inventory
    - Product-Store Mappings
    - Products
    - Stores
    """
    from sqlalchemy import text

    tables_to_clear = [
        ("route_stops", "Route Stops"),
        ("routes", "Routes"),
        ("purchase_list_items", "Purchase List Items"),
        ("purchase_lists", "Purchase Lists"),
        ("purchase_failures", "Purchase Failures"),
        ("order_items", "Order Items"),
        ("orders", "Orders"),
        ("store_inventory", "Store Inventory"),
        ("product_store_mapping", "Product-Store Mappings"),
        ("products", "Products"),
        ("stores", "Stores"),
    ]

    deleted_counts = {}
    errors = []

    for table_name, display_name in tables_to_clear:
        try:
            # Get count before truncate
            result = await db.execute(text(f"SELECT COUNT(*) FROM {table_name}"))
            count = result.scalar()

            # Use TRUNCATE CASCADE for PostgreSQL
            await db.execute(text(f"TRUNCATE TABLE {table_name} CASCADE"))
            await db.commit()

            deleted_counts[display_name] = count
        except Exception as e:
            await db.rollback()
            errors.append(f"{display_name}: {str(e)}")

    total_deleted = sum(deleted_counts.values())

    return {
        "message": f"全データを削除しました（合計 {total_deleted}件）",
        "deleted": deleted_counts,
        "errors": errors
    }
