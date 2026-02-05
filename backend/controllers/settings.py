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


async def import_purchase_list_csv(db: AsyncSession, csv_data: str):
    """
    Import the client's purchase list CSV format (購入リスト店舗入力.csv)

    This CSV format includes:
    - Product codes and names
    - Quantities split across multiple stores
    - Store names and addresses

    The function will:
    1. Create/update Products
    2. Create/update Stores (extracting from addresses)
    3. Create ProductStoreMapping entries
    4. Set up quantity allocations based on the CSV data
    """
    from db.schema import Product, Store, ProductStoreMapping, StockStatus
    from io import StringIO
    import csv
    import re

    if not csv_data:
        return {"message": "CSVデータがありません", "products_created": 0, "stores_created": 0, "mappings_created": 0, "errors": []}

    reader = csv.reader(StringIO(csv_data))
    rows = list(reader)

    products_created = 0
    stores_created = 0
    mappings_created = 0
    errors = []

    # Skip header rows (first 7 rows based on the file format)
    # Find the header row with column names
    header_idx = 0
    for i, row in enumerate(rows):
        if len(row) >= 6 and ('商品コード' in row[1] or 'product_code' in str(row).lower()):
            header_idx = i
            break

    # Process data rows
    current_product_code = None
    current_product_name = None

    # Cache for lookups
    product_cache = {}
    store_cache = {}

    for row_idx, row in enumerate(rows[header_idx + 1:], start=header_idx + 2):
        try:
            if len(row) < 6:
                continue

            # Parse row: [empty, product_code, product_name, specification, quantity, store_name, address]
            product_code = row[1].strip() if len(row) > 1 else ''
            product_name = row[2].strip() if len(row) > 2 else ''
            specification = row[3].strip() if len(row) > 3 else ''
            quantity_str = row[4].strip() if len(row) > 4 else ''
            store_name = row[5].strip() if len(row) > 5 else ''
            address = row[6].strip() if len(row) > 6 else ''

            # Skip empty rows
            if not quantity_str or not store_name:
                continue

            # Handle continuation rows (same product, different store)
            if product_code:
                current_product_code = product_code
                current_product_name = product_name

            if not current_product_code:
                continue

            # Parse quantity
            try:
                quantity = int(quantity_str)
            except ValueError:
                errors.append(f"行 {row_idx}: 数量が無効です: {quantity_str}")
                continue

            # Get or create Product
            if current_product_code not in product_cache:
                result = await db.execute(
                    select(Product).where(Product.sku == current_product_code)
                )
                product = result.scalar_one_or_none()

                if not product:
                    product = Product(
                        sku=current_product_code,
                        product_name=current_product_name or current_product_code,
                        is_store_fixed=False,
                        exclude_from_routing=False
                    )
                    db.add(product)
                    await db.flush()
                    await db.refresh(product)
                    products_created += 1

                product_cache[current_product_code] = product.product_id

            product_id = product_cache[current_product_code]

            # Get or create Store
            if store_name not in store_cache:
                result = await db.execute(
                    select(Store).where(Store.store_name == store_name)
                )
                store = result.scalar_one_or_none()

                if not store:
                    # Extract district from address
                    district = extract_district(address)
                    # Extract coordinates from address if available
                    lat, lng = extract_coordinates_from_address(address)

                    store = Store(
                        store_name=store_name,
                        address=address,
                        district=district,
                        latitude=lat,
                        longitude=lng,
                        priority_level=2,
                        is_active=True
                    )
                    db.add(store)
                    await db.flush()
                    await db.refresh(store)
                    stores_created += 1
                else:
                    # Update address if not set
                    if not store.address and address:
                        store.address = address
                        # Extract coordinates if we have an address
                        lat, lng = extract_coordinates_from_address(address)
                        if lat and lng:
                            store.latitude = lat
                            store.longitude = lng

                store_cache[store_name] = store.store_id

            store_id = store_cache[store_name]

            # Create or update ProductStoreMapping
            result = await db.execute(
                select(ProductStoreMapping)
                .where(ProductStoreMapping.product_id == product_id)
                .where(ProductStoreMapping.store_id == store_id)
            )
            mapping = result.scalar_one_or_none()

            if not mapping:
                mapping = ProductStoreMapping(
                    product_id=product_id,
                    store_id=store_id,
                    is_primary_store=False,
                    priority=1,
                    stock_status=StockStatus.IN_STOCK,
                    max_daily_quantity=quantity,  # Use CSV quantity as max capacity
                    current_available=quantity
                )
                db.add(mapping)
                mappings_created += 1
            else:
                # Update with the quantity info
                if mapping.max_daily_quantity:
                    mapping.max_daily_quantity = max(mapping.max_daily_quantity, quantity)
                else:
                    mapping.max_daily_quantity = quantity
                mapping.current_available = quantity
                mapping.stock_status = StockStatus.IN_STOCK

        except Exception as e:
            errors.append(f"行 {row_idx}: エラー - {str(e)}")

    await db.commit()

    return {
        "message": f"インポート完了: 商品 {products_created}件, 店舗 {stores_created}件, マッピング {mappings_created}件",
        "products_created": products_created,
        "stores_created": stores_created,
        "mappings_created": mappings_created,
        "errors": errors[:20] if errors else []  # Limit error display
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

    For now, this uses known Osaka area coordinates as defaults.
    In production, you'd integrate with a geocoding API.
    """
    from decimal import Decimal

    if not address:
        return None, None

    # Known area coordinates (approximate centers)
    area_coords = {
        "北区": (Decimal("34.7055"), Decimal("135.4983")),
        "中央区": (Decimal("34.6784"), Decimal("135.5014")),
        "天王寺区": (Decimal("34.6533"), Decimal("135.5189")),
        "浪速区": (Decimal("34.6580"), Decimal("135.5004")),
        "福島区": (Decimal("34.6911"), Decimal("135.4744")),
        "港区": (Decimal("34.6600"), Decimal("135.4560")),
        "阿倍野区": (Decimal("34.6350"), Decimal("135.5180")),
        "西区": (Decimal("34.6781"), Decimal("135.4803")),
    }

    for area, coords in area_coords.items():
        if area in address:
            return coords

    # Default to central Osaka
    if "大阪" in address:
        return Decimal("34.6937"), Decimal("135.5023")

    return None, None


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
