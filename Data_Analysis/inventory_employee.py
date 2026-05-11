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
# 2. VALIDATION, UTILITIES & BRANCH SCOPE
# ==========================================

def save_json_to_text(data, filename="inventory_employee_output.txt"):
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

def get_inventory_scope_filter(context, table_alias='i'):
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
# 3. LOCAL BRANCH INVENTORY METRICS
#====================================================================================

def get_my_personal_info(uid):
    ctx = get_user_context(uid)
    query = f"SELECT emp_id, first_name, last_name, role, branch_id, secondary_branch_id FROM employee WHERE emp_id = {uid}"
    df = pd.read_sql(query, engine)
    return {"data": safe_to_dict(df), "warnings": [], "chart": None}

def get_branch_total_units(uid):
    ctx = get_user_context(uid)
    i_scope = get_inventory_scope_filter(ctx, 'i')
    query = f"""
        SELECT
        i.branch_id,
        b.location AS branch_name,
        SUM(i.quantity_changed) AS total_units
        FROM inventory_log i
        JOIN branch b ON i.branch_id = b.b_id
        WHERE 1=1 {i_scope}
        GROUP BY i.branch_id, b.location;
    """
    df = pd.read_sql(query, engine)
    
    # We keep 'branch_name' here because we used 'AS branch_name' in the SQL query
    chart = generate_chart(df, 'bar', 'Total Units in Branch', x='branch_name', y='total_units')
    return {"data": safe_to_dict(df), "warnings": [], "chart": chart}



def get_branch_low_stock_alerts(uid):
    ctx = get_user_context(uid)
    i_scope = get_inventory_scope_filter(ctx, 'i')

    # Low stock (1–20 units)
    query_low = f"""
        SELECT i.branch_id, p.product_id, p.name, p.model, p.type, SUM(i.quantity_changed) as amount_avail
        FROM inventory_log i
        JOIN product p ON i.product_id = p.product_id
        WHERE 1=1 {i_scope}
        GROUP BY i.branch_id, p.product_id, p.name, p.model, p.type
        HAVING amount_avail > 0 AND amount_avail <= 20
        ORDER BY amount_avail ASC
    """
    # Out of stock (sum = 0)
    query_oos = f"""
        SELECT i.branch_id, p.product_id, p.name, p.model, p.type, SUM(i.quantity_changed) as amount_avail
        FROM inventory_log i
        JOIN product p ON i.product_id = p.product_id
        WHERE 1=1 {i_scope}
        GROUP BY i.branch_id, p.product_id, p.name, p.model, p.type
        HAVING amount_avail = 0
        ORDER BY p.name ASC
    """
    df_low = pd.read_sql(query_low, engine)
    df_oos = pd.read_sql(query_oos, engine)

    data_low = safe_to_dict(df_low)
    data_oos = safe_to_dict(df_oos)

    warnings = []
    for row in data_oos:
        warnings.append(f"CRITICAL: Product ID {row.get('product_id')} — {row.get('name')} ({row.get('model', '')}) is OUT OF STOCK")
    for row in data_low:
        warnings.append(f"WARNING: Low Stock — Product ID {row.get('product_id')} — {row.get('name')} ({row.get('model', '')}) — {row.get('amount_avail')} units remaining")

    return {"data": data_low + data_oos, "warnings": warnings, "chart": None}



def get_branch_category_breakdown(uid):
    ctx = get_user_context(uid)
    i_scope = get_inventory_scope_filter(ctx, 'i')
    query = f"""
        SELECT i.branch_id, p.type, SUM(i.quantity_changed) as total_units, COUNT(DISTINCT p.product_id) as unique_product_lines 
        FROM inventory_log i 
        JOIN product p ON i.product_id = p.product_id 
        WHERE 1=1 {i_scope} 
        GROUP BY i.branch_id, p.type 
        HAVING total_units > 0
        ORDER BY total_units DESC
    """
    df = pd.read_sql(query, engine)
    chart = generate_chart(df, 'pie', 'Branch Category Breakdown', names='type', values='total_units')
    return {"data": safe_to_dict(df), "warnings": [], "chart": chart}

def get_branch_recent_activity(uid):
    ctx = get_user_context(uid)
    i_scope = get_inventory_scope_filter(ctx, 'i')
    query = f"""
        SELECT i.log_id, i.branch_id, i.storage_id, i.date, p.name, p.model, i.quantity_changed, i.type_of_change 
        FROM inventory_log i JOIN product p ON i.product_id = p.product_id 
        WHERE 1=1 {i_scope} ORDER BY i.date DESC, i.log_id DESC LIMIT 15
    """
    df = pd.read_sql(query, engine)
    return {"data": safe_to_dict(df), "warnings": [], "chart": None}


def get_branch_largest_restocks(uid, year=None, month=None, product_name=None):
    """
    Full restock history from storage to branch.
    Supports optional filtering by year, month, and product name.
    Also includes 6-month inventory flow trends merged in.
    """
    ctx = get_user_context(uid)
    i_scope = get_inventory_scope_filter(ctx, 'i')

    yr_clause   = f"AND YEAR(i.date) = {int(year)}"   if year  else ""
    mo_clause   = f"AND MONTH(i.date) = {int(month)}" if month else ""
    prod_clause = f"AND p.name LIKE '%{product_name}%'" if product_name else ""

    # Restock history (storage → branch, type_of_change = 'out' means out of storage = into branch)
    query_restocks = f"""
        SELECT i.branch_id, b.location AS branch_name, i.date, p.product_id, p.name, p.model, p.type,
               i.quantity_changed, i.type_of_change, i.storage_id
        FROM inventory_log i
        JOIN product p ON i.product_id = p.product_id
        JOIN branch b ON i.branch_id = b.b_id
        WHERE i.quantity_changed > 0
          AND TRIM(LOWER(i.type_of_change)) = 'out'
          {i_scope} {yr_clause} {mo_clause} {prod_clause}
        ORDER BY i.date DESC, i.quantity_changed DESC
        LIMIT 30
    """
    df_restocks = pd.read_sql(query_restocks, engine)

    # 6-month flow trend
    query_flow = f"""
        SELECT CONCAT(YEAR(i.date), '-', LPAD(MONTH(i.date), 2, '0')) as month,
               i.type_of_change, SUM(ABS(i.quantity_changed)) as unit_volume
        FROM inventory_log i
        WHERE i.date >= DATE_SUB(CURDATE(), INTERVAL 6 MONTH) {i_scope}
        GROUP BY month, i.type_of_change ORDER BY month ASC
    """
    df_flow = pd.read_sql(query_flow, engine)
    flow_chart = generate_chart(df_flow, 'line', 'Branch 6-Month Inventory Flow', x='month', y='unit_volume', color='type_of_change')

    restock_chart = generate_chart(df_restocks, 'bar', 'Branch Restock History (From Storage)', x='name', y='quantity_changed', color='type')

    return {
        "data": safe_to_dict(df_restocks),
        "flow_data": safe_to_dict(df_flow),
        "warnings": [],
        "chart": restock_chart,
        "flow_chart": flow_chart,
        "filters_applied": {"year": year, "month": month, "product": product_name},
    }

def get_branch_stale_inventory(uid):
    ctx = get_user_context(uid)
    i_scope = get_inventory_scope_filter(ctx, 'i')
    query = f"""
        SELECT i.branch_id, p.product_id, p.name, p.model, SUM(i.quantity_changed) as amount_avail
        FROM inventory_log i
        JOIN product p ON i.product_id = p.product_id
        WHERE 1=1 {i_scope}
        GROUP BY i.branch_id, p.product_id, p.name, p.model
        HAVING amount_avail > 0 AND MAX(i.date) < DATE_SUB(CURDATE(), INTERVAL 30 DAY)
    """
    df   = pd.read_sql(query, engine)
    data = safe_to_dict(df)
    warnings = [
        f"WARNING: Stale Inventory — Product ID {row.get('product_id')} — {row.get('name')} ({row.get('model','')}) — {row.get('amount_avail')} units sitting for 30+ days"
        for row in data
    ]
    return {"data": data, "warnings": warnings, "chart": None}

def get_branch_inventory_flow_trends(uid):
    # This function has been merged into get_branch_largest_restocks.
    # Kept as a pass-through for backward compatibility.
    return get_branch_largest_restocks(uid)

def get_branch_quarterly_restock_forecast(uid):
    ctx = get_user_context(uid)
    i_scope = get_inventory_scope_filter(ctx, 'i')
    query = f"""
        SELECT YEAR(i.date) as yr, QUARTER(i.date) as qtr, SUM(ABS(i.quantity_changed)) as volume 
        FROM inventory_log i 
        WHERE TRIM(LOWER(i.type_of_change)) = 'out' {i_scope} 
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
            if proj_vol > avg_past * 1.3:
                warnings.append(f"WARNING: Projected branch inbound volume ({proj_vol:.0f} units) for Q{curr_qtr} is significantly above historical average ({avg_past:.0f} units).")
        
        df.loc[curr_mask, 'type'] = 'Actual (So Far)'
        proj_row = pd.DataFrame([{'yr': curr_yr, 'qtr': curr_qtr, 'volume': max(proj_vol - curr_vol, 0), 'period': f'{curr_yr}-Q{curr_qtr}', 'type': 'Projected Remainder'}])
        df = pd.concat([df, proj_row], ignore_index=True)
        
    chart = generate_chart(df, 'bar', 'Quarterly Branch Inbound (Out of Storage) Forecast', x='period', y='volume', color='type')
    return {"data": safe_to_dict(df.round(2)), "warnings": warnings, "chart": chart}

def run_all_inventory_employee_metrics(user_id):
    results = {}
    employee_funcs = [
        get_my_personal_info, get_branch_total_units, get_branch_low_stock_alerts,
        get_branch_category_breakdown,
        get_branch_recent_activity,
        get_branch_largest_restocks, get_branch_stale_inventory, 
        get_branch_inventory_flow_trends, get_branch_quarterly_restock_forecast
    ]
    for func in employee_funcs:
        try: results[func.__name__] = func(user_id)
        except Exception as e: results[func.__name__] = {"data": [], "warnings": [f"Error: {str(e)}"], "chart": None}
    return results

#===============================================================================
# 5. NODE.JS EXECUTION BRIDGE & TESTING
#===============================================================================

if __name__ == "__main__":
    try:
        if len(sys.argv) > 1:
            emp_id = int(sys.argv[1])
        else:
            emp_id = 91422 

        results = run_all_inventory_employee_metrics(emp_id) 
        save_json_to_text(results, "inventory_employee_output.txt")
        print(json.dumps(results, indent=4))

    except Exception as e:
        error_json = {"error": str(e)}
        save_json_to_text(error_json, "inventory_error_log.txt")
        print(json.dumps(error_json, indent=4))