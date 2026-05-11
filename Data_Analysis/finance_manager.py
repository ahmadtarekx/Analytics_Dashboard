import os
import sys
import json
import calendar
import pandas as pd
import plotly.express as px
from datetime import date, datetime
from sqlalchemy import create_engine
from dotenv import load_dotenv

# ==========================================
# 1. SETUP & SECURE DATABASE CONNECTION
# ==========================================
load_dotenv()

def get_db_engine():
    user = os.getenv("DB_USER", "root")
    password = os.getenv("DB_PASSWORD", "samka1234")
    host = os.getenv("DB_HOST", "localhost")
    database = os.getenv("DB_NAME", "mydb")
    return create_engine(f"mysql+pymysql://{user}:{password}@{host}/{database}")

engine = get_db_engine()

# ==========================================
# 2. VALIDATION, UTILITIES & SALES SCOPE
# ==========================================

def save_json_to_text(data, filename="finance_manager_output.txt"):
    try:
        current_dir = os.path.dirname(os.path.abspath(__file__))
        file_path = os.path.join(current_dir, filename)
        with open(file_path, "w", encoding="utf-8") as f:
            json.dump(data, f, indent=4)
    except Exception as e:
        print(f"FAILED TO SAVE TEXT FILE: {e}", file=sys.stderr)

def get_user_context(user_id):
    query = f"SELECT role, branch_id, secondary_branch_id, departement_id FROM employee WHERE emp_id = {user_id}"
    df = pd.read_sql(query, engine)
    if df.empty:
        raise ValueError(f"Access Denied: User ID {user_id} not found.")
    return df.iloc[0].to_dict()

def get_sales_scope_filter(context, table_alias='f'):
    b_id = context.get('branch_id')
    sb_id = context.get('secondary_branch_id')
    valid_branches = []
    if pd.notna(b_id) and b_id is not None:
        valid_branches.append(str(int(float(b_id))))
    if pd.notna(sb_id) and sb_id is not None and str(sb_id).strip().upper() not in ['NULL', 'NONE', '']:
        valid_branches.append(str(int(float(sb_id))))
    if not valid_branches:
        return " AND 1=0 " 
    branches_str = ",".join(valid_branches)
    return f" AND {table_alias}.branch_id IN ({branches_str}) "

def safe_to_dict(df):
    if df.empty:
        return []
    # Handle numpy datetime64 columns
    for col in df.select_dtypes(include=['datetime64']).columns:
        df[col] = df[col].astype(str)
    # Handle object columns containing Python date/datetime instances
    for col in df.select_dtypes(include=['object']).columns:
        df[col] = df[col].apply(
            lambda x: x.isoformat() if isinstance(x, (date, datetime)) else x
        )
    return df.where(pd.notnull(df), None).to_dict(orient='records')

def evaluate_warnings(data, metric_key, threshold, condition='less', alert_msg="Alert"):
    warnings = []
    for row in data:
        val = row.get(metric_key)
        if pd.isna(val) or val is None: continue
        if condition == 'less' and float(val) < threshold:
            warnings.append(f"WARNING: {alert_msg} ({val})")
        elif condition == 'greater' and float(val) > threshold:
            warnings.append(f"WARNING: {alert_msg} ({val})")
    return warnings

def generate_chart(df, chart_type, title, x=None, y=None, names=None, values=None, color=None):
    if df.empty: return None
    df_plot = df.copy()
    for col in [x, names]:
        if col and col in df_plot.columns and df_plot[col].dtype in ['int64', 'float64'] and 'id' in col.lower():
            df_plot[col] = df_plot[col].astype(str)
    try:
        if chart_type == 'bar': fig = px.bar(df_plot, x=x, y=y, color=color, title=title)
        elif chart_type == 'pie': fig = px.pie(df_plot, names=names, values=values, color=color, title=title)
        elif chart_type == 'line': fig = px.line(df_plot, x=x, y=y, color=color, title=title)
        else: return None
        return json.loads(fig.to_json())
    except Exception:
        return None

#====================================================================================
# 3. SALES METRICS (Global / Manager Level)
#====================================================================================

def get_global_total_revenue(uid):
    # We still fetch the context for safety/consistency, but we will ignore it for the scope
    ctx = get_user_context(uid)
    
    # OVERRIDE: Set scope to empty string to bypass user limits and show ALL branches
    f_scope = "" 
    
    # Updated query to join the branch table and select the location
    query = f"""
        SELECT 
            f.branch_id, 
            b.location,
            SUM(f.price) as total_revenue 
        FROM financial_record f 
        JOIN branch b ON f.branch_id = b.b_id
        WHERE f.transaction_type = 'sale' {f_scope} 
        GROUP BY f.branch_id, b.location
    """
    
    df = pd.read_sql(query, engine)
    
    # Changed x='branch_id' to x='location' so the bar chart labels show the actual names!
    chart = generate_chart(df, 'bar', 'Global Revenue by Branch', x='location', y='total_revenue')
    
    return {"data": safe_to_dict(df.round(2)), "warnings": [], "chart": chart}

def get_global_total_units_sold(uid):
    # Fetch context for consistency, but ignore it for the scope
    ctx = get_user_context(uid)
    
    # OVERRIDE: Set scope to an empty string to show ALL branches globally
    f_scope = "" 
    
    # Updated query to join the branch table and pull the location name
    query = f"""
        SELECT 
            f.branch_id, 
            b.location,
            SUM(f.amount) as total_units 
        FROM financial_record f 
        JOIN branch b ON f.branch_id = b.b_id
        WHERE f.transaction_type = 'sale' {f_scope} 
        GROUP BY f.branch_id, b.location
    """
    
    df = pd.read_sql(query, engine)
    
    # Changed names='branch_id' to names='location' so your pie chart shows "Maadi", "Zamalek", etc.
    chart = generate_chart(df, 'pie', 'Units Sold Contribution', names='location', values='total_units')
    
    return {"data": safe_to_dict(df), "warnings": [], "chart": chart}

def get_global_avg_transaction_value(uid):
    ctx = get_user_context(uid)
    f_scope = "" 
    
    # 1. Query for the TRUE mathematically correct overall average across ALL branches
    # (Taking an average of averages is mathematically inaccurate, so we query the raw table)
    true_avg_query = f"SELECT AVG(price) as overall_avg_transaction_value FROM financial_record WHERE transaction_type = 'sale'"
    true_avg_df = pd.read_sql(true_avg_query, engine)
    overall_average = float(true_avg_df['overall_avg_transaction_value'].iloc[0] or 0)
    
    # 2. Branch-level breakdown for the supporting chart and detail table
    query = f"""
        SELECT 
            f.branch_id, 
            b.location,
            AVG(f.price) as avg_order_value,
            COUNT(f.record_id) as transaction_count
        FROM financial_record f 
        JOIN branch b ON f.branch_id = b.b_id
        WHERE f.transaction_type = 'sale' {f_scope} 
        GROUP BY f.branch_id, b.location
        ORDER BY avg_order_value DESC
    """
    df = pd.read_sql(query, engine)
    
    chart = generate_chart(df, 'bar', 'Avg Transaction Value by Branch', x='location', y='avg_order_value')
    
    # 3. Return overall_average as primary metric + branch breakdown in data
    return {
        "data": [{"overall_avg_transaction_value": round(overall_average, 2), "total_branches": len(df)}] + safe_to_dict(df.round(2)),
        "warnings": [], 
        "chart": chart,
        "overall_average": round(overall_average, 2)
    }

def get_global_top_products_by_revenue(uid):
    """Top 10 products by revenue across ALL branches — rendered as a leaderboard in the dashboard."""
    ctx = get_user_context(uid)
    f_scope = ""  # All branches
    
    query = f"""
        SELECT 
            f.product_id, 
            p.name, 
            p.model, 
            SUM(f.price) as product_revenue,
            SUM(f.amount) as units_sold
        FROM financial_record f 
        JOIN product p ON f.product_id = p.product_id
        WHERE f.transaction_type = 'sale' {f_scope} 
        GROUP BY f.product_id, p.name, p.model 
        ORDER BY product_revenue DESC 
        LIMIT 10
    """
    
    df = pd.read_sql(query, engine)
    data = safe_to_dict(df.round(2))
    
    # Leaderboard chart type — frontend renders this as a ranked list, not a bar chart
    chart = {
        "type": "leaderboard",
        "title": "Top 10 Products by Revenue (Global)",
        "data": data
    }
    
    return {"data": data, "warnings": [], "chart": chart}

def get_global_recent_transactions(uid):
    ctx = get_user_context(uid)
    f_scope = get_sales_scope_filter(ctx, 'f')
    query = f"""
        SELECT f.record_id, f.branch_id, f.product_id, f.transaction_type, f.amount, f.price, f.transaction_date 
        FROM financial_record f WHERE 1=1 {f_scope} ORDER BY f.transaction_date DESC LIMIT 15
    """
    df = pd.read_sql(query, engine)
    return {"data": safe_to_dict(df), "warnings": [], "chart": None}

def get_global_operating_expenses(uid):
    # We still fetch context just in case other parts of your app expect it to run, 
    # but we will intentionally ignore the scope limits.
    ctx = get_user_context(uid)
    
    # OVERRIDE: Set scopes to empty strings to bypass the user restrictions
    # This turns 'WHERE 1=1 AND branch_id IN (11)' into just 'WHERE 1=1'
    ex_scope = "" 
    e_scope = ""
    
    query = f"""
        SELECT 
            c.branch_id, 
            b.location,
            c.expense_type, 
            SUM(c.amount) as total_expense 
        FROM (
            SELECT ex.branch_id, ex.expense_type, SUM(ex.amount) as amount 
            FROM branch_expenses_record ex 
            WHERE 1=1 {ex_scope} 
            GROUP BY ex.branch_id, ex.expense_type
            
            UNION ALL
            
            SELECT e.branch_id, 'salaries' as expense_type, SUM(e.salary) as amount 
            FROM employee e 
            WHERE 1=1 {e_scope} 
            GROUP BY e.branch_id
        ) c
        JOIN branch b ON c.branch_id = b.b_id
        GROUP BY c.branch_id, b.location, c.expense_type
    """
    
    df = pd.read_sql(query, engine)
    
    # The chart will now use 'location' (e.g., "Heliopolis, Cairo") for the colors
    chart = generate_chart(df, 'bar', 'Global OPEX (Inc. Salaries)', x='expense_type', y='total_expense', color='location')
    
    return {"data": safe_to_dict(df.round(2)), "warnings": [], "chart": chart}

def get_global_sales_vs_refunds(uid):
    # Fetch context just in case, but ignore it for the scope
    ctx = get_user_context(uid)
    
    # OVERRIDE: Set scope to an empty string to show ALL branches
    f_scope = "" 
    
    # Updated query to join the branch table and grab the location name
    query = f"""
        SELECT 
            f.branch_id, 
            b.location,
            f.transaction_type, 
            COUNT(f.record_id) as volume, 
            SUM(f.price) as total_value 
        FROM financial_record f 
        JOIN branch b ON f.branch_id = b.b_id
        WHERE 1=1 {f_scope} 
        GROUP BY f.branch_id, b.location, f.transaction_type
    """
    
    df = pd.read_sql(query, engine)
    
    # Changed x='branch_id' to x='location' so your grouped/stacked bars have readable names
    chart = generate_chart(df, 'bar', 'Sales vs Refunds by Branch', x='location', y='total_value', color='transaction_type')
    
    return {"data": safe_to_dict(df.round(2)), "warnings": [], "chart": chart}


def get_global_restock_costs(uid, year=None, month=None):
    """Restock costs for ALL branches. Optional year/month filter lets the user drill into a specific period."""
    ctx = get_user_context(uid)
    
    # Build optional date filter
    date_filter = ""
    if year and month:
        date_filter = f"AND DATE_FORMAT(i.date, '%%Y-%%m') = '{int(year):04d}-{int(month):02d}'"
    elif year:
        date_filter = f"AND YEAR(i.date) = {int(year)}"
    
    query = f"""
        SELECT 
            COALESCE(b.location, 'Warehouse') as location, 
            DATE_FORMAT(i.date, '%%Y-%%m') as month, 
            SUM(i.quantity_changed * p.price_before_profit) as cost
        FROM inventory_log i 
        JOIN product p ON i.product_id = p.product_id
        LEFT JOIN branch b ON i.branch_id = b.b_id
        WHERE i.type_of_change = 'restock'
        {date_filter}
        GROUP BY location, month 
        ORDER BY month ASC
    """
    
    df = pd.read_sql(query, engine)
    
    period_label = None
    if year and month:
        import calendar as cal
        period_label = f"{cal.month_abbr[int(month)]} {year}"
    elif year:
        period_label = str(year)
    
    chart = generate_chart(df, 'line', 'Global Restock Expenditure', x='month', y='cost', color='location')
    
    result = {"data": safe_to_dict(df.round(2)), "warnings": [], "chart": chart}
    if period_label:
        result["period"] = period_label
    return result

def get_global_damage_impact(uid):
    ctx = get_user_context(uid)
    # OVERRIDE: Show damage losses for ALL branches globally
    
    query = f"""
        SELECT 
            i.branch_id, 
            b.location as Name, 
            SUM(i.quantity_changed * p.price_before_profit) as lost_value
        FROM inventory_log i 
        JOIN product p ON i.product_id = p.product_id
        JOIN branch b ON i.branch_id = b.b_id
        WHERE i.type_of_change = 'damaged' 
        GROUP BY i.branch_id, b.location
        ORDER BY lost_value DESC
    """
    
    df = pd.read_sql(query, engine)
    data = safe_to_dict(df.round(2))
    
    warnings = evaluate_warnings(data, 'lost_value', 10000, 'greater', "High damage write-off detected")
    
    chart = generate_chart(df, 'bar', 'Global Damage Losses', x='Name', y='lost_value')
    
    return {"data": data, "warnings": warnings, "chart": chart}


def get_global_inventory_flow(uid, year=None, month=None):
    """Inventory flow (all movement types) for ALL branches. Optional year/month filter for period drill-down."""
    ctx = get_user_context(uid)
    
    # Build optional date filter
    date_filter = ""
    if year and month:
        date_filter = f"AND DATE_FORMAT(i.date, '%%Y-%%m') = '{int(year):04d}-{int(month):02d}'"
    elif year:
        date_filter = f"AND YEAR(i.date) = {int(year)}"
    
    query = f"""
        SELECT 
            DATE_FORMAT(i.date, '%%Y-%%m') as month, 
            i.type_of_change, 
            SUM(i.quantity_changed) as volume
        FROM inventory_log i 
        WHERE 1=1 {date_filter}
        GROUP BY month, i.type_of_change 
        ORDER BY month ASC
    """
    
    df = pd.read_sql(query, engine)
    
    period_label = None
    if year and month:
        import calendar as cal
        period_label = f"{cal.month_abbr[int(month)]} {year}"
    elif year:
        period_label = str(year)
    
    chart = generate_chart(df, 'line', 'Global Inventory Flow Trends', x='month', y='volume', color='type_of_change')
    
    result = {"data": safe_to_dict(df), "warnings": [], "chart": chart}
    if period_label:
        result["period"] = period_label
    return result

#====================================================================================
# NEW FORECASTING & COMPARISON FUNCTIONS
#====================================================================================

def get_global_quarterly_revenue_forecast(uid):
    """Compares past quarter global revenue to current and predicts quarter end volume."""
    ctx = get_user_context(uid)
    
    # OVERRIDE: Set scope to an empty string so it pulls sales from ALL 10 branches
    f_scope = "" 
    
    query = f"""
        SELECT YEAR(f.transaction_date) as yr, QUARTER(f.transaction_date) as qtr, SUM(f.price) as volume 
        FROM financial_record f 
        WHERE f.transaction_type = 'sale' {f_scope} 
        GROUP BY yr, qtr ORDER BY yr, qtr
    """
    df = pd.read_sql(query, engine)
    
    if df.empty:
        return {"data": [], "warnings": [], "chart": None}

    today = pd.Timestamp.now()
    curr_yr, curr_qtr = today.year, today.quarter
    
    q_start = pd.Timestamp(curr_yr, 3 * curr_qtr - 2, 1)
    days_passed = max((today - q_start).days, 1)
    
    if curr_qtr == 1: total_days = 90 if calendar.isleap(curr_yr) else 89
    elif curr_qtr == 2: total_days = 91
    else: total_days = 92
        
    multiplier = total_days / days_passed
    warnings = []
    
    df['period'] = df['yr'].astype(str) + '-Q' + df['qtr'].astype(str)
    df['type'] = 'Actual'
    
    curr_mask = (df['yr'] == curr_yr) & (df['qtr'] == curr_qtr)
    if curr_mask.any():
        curr_vol = df.loc[curr_mask, 'volume'].values[0]
        proj_vol = float(curr_vol * multiplier)
        
        past_vols = df.loc[~curr_mask, 'volume']
        if not past_vols.empty:
            avg_past = past_vols.mean()
            if proj_vol < avg_past * 0.85:
                warnings.append(f"WARNING: Global projected revenue (${proj_vol:,.2f}) for Q{curr_qtr} is significantly below historical average (${avg_past:,.2f}).")
        
        df.loc[curr_mask, 'type'] = 'Actual (So Far)'
        proj_row = pd.DataFrame([{'yr': curr_yr, 'qtr': curr_qtr, 'volume': max(proj_vol - curr_vol, 0), 'period': f'{curr_yr}-Q{curr_qtr}', 'type': 'Projected Remainder'}])
        df = pd.concat([df, proj_row], ignore_index=True)
        
    chart = generate_chart(df, 'bar', 'Global Quarterly Revenue Forecast', x='period', y='volume', color='type')
    return {"data": safe_to_dict(df.round(2)), "warnings": warnings, "chart": chart}

#===============================================================================
# 4. EXECUTION WRAPPERS
#===============================================================================

def run_all_sales_metrics(user_id, restock_year=None, restock_month=None, inv_flow_fm_year=None, inv_flow_fm_month=None):
    results = {}
    simple_funcs = [
        get_global_total_revenue, get_global_total_units_sold, 
        get_global_avg_transaction_value,
        get_global_recent_transactions, get_global_operating_expenses,
        get_global_sales_vs_refunds,
        get_global_damage_impact,
        get_global_quarterly_revenue_forecast
    ]
    
    for func in simple_funcs:
        try: results[func.__name__] = func(user_id)
        except Exception as e: results[func.__name__] = {"data": [], "warnings": [f"Error: {str(e)}"], "chart": None}
    
    # Restock costs — supports year/month filter
    try:
        results['get_global_restock_costs'] = get_global_restock_costs(user_id, year=restock_year, month=restock_month)
    except Exception as e:
        results['get_global_restock_costs'] = {"data": [], "warnings": [f"Error: {str(e)}"], "chart": None}

    # Inventory flow — supports year/month filter
    try:
        results['get_global_inventory_flow'] = get_global_inventory_flow(user_id, year=inv_flow_fm_year, month=inv_flow_fm_month)
    except Exception as e:
        results['get_global_inventory_flow'] = {"data": [], "warnings": [f"Error: {str(e)}"], "chart": None}
            
    return results

#===============================================================================
# 5. NODE.JS EXECUTION BRIDGE & TESTING
#===============================================================================

if __name__ == "__main__":
    try:
        if len(sys.argv) > 1:
            emp_id = int(sys.argv[1])
        else:
            emp_id = 6265

        # Parse optional key=value args: restock_year=2025 restock_month=1 inv_flow_fm_year=2025 inv_flow_fm_month=4
        kv_args = {}
        for arg in sys.argv[2:]:
            if '=' in arg:
                k, v = arg.split('=', 1)
                kv_args[k.strip()] = v.strip()

        restock_year    = int(kv_args['restock_year'])    if 'restock_year'    in kv_args else None
        restock_month   = int(kv_args['restock_month'])   if 'restock_month'   in kv_args else None
        inv_flow_fm_year  = int(kv_args['inv_flow_fm_year'])  if 'inv_flow_fm_year'  in kv_args else None
        inv_flow_fm_month = int(kv_args['inv_flow_fm_month']) if 'inv_flow_fm_month' in kv_args else None

        results = run_all_sales_metrics(
            emp_id,
            restock_year=restock_year,
            restock_month=restock_month,
            inv_flow_fm_year=inv_flow_fm_year,
            inv_flow_fm_month=inv_flow_fm_month
        )
        save_json_to_text(results, "finance_manager_output.txt")
        print(json.dumps(results, indent=4))

    except Exception as e:
        error_json = {"error": str(e)}
        save_json_to_text(error_json, "finance_error_log.txt")
        print(json.dumps(error_json, indent=4))