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
# 2. VALIDATION, UTILITIES & FINANCE SCOPE
# ==========================================

def save_json_to_text(data, filename="finance_employee_output.txt"):
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

def get_finance_scope_filter(context, table_alias):
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
# 3. FINANCE METRICS (Scoped to Manager's Branches)
#====================================================================================


def get_finance_opex_breakdown(uid):
    ctx = get_user_context(uid)
    ex_scope = get_finance_scope_filter(ctx, 'ex')
    e_scope = get_finance_scope_filter(ctx, 'e')
    
    # 1. Wrapped the UNION ALL in a subquery 'c'
    # 2. Joined branch 'b' on b_id
    # 3. Added b.location to the SELECT and GROUP BY clauses
    query = f"""
        SELECT 
            c.branch_id, 
            b.location,
            c.expense_type, 
            SUM(c.amount) as amount 
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
    
    # The pie chart still groups by expense_type so you see the split of Salaries vs Rent vs Electricity
    # But your detailed data table will now include the actual location name!
    chart = generate_chart(df, 'pie', 'OPEX Breakdown (Inc. Salaries)', names='expense_type', values='amount')
    
    return {"data": safe_to_dict(df.round(2)), "warnings": [], "chart": chart}

def get_finance_branch_total_opex(uid):
    ctx = get_user_context(uid)
    ex_scope = get_finance_scope_filter(ctx, 'ex')
    e_scope = get_finance_scope_filter(ctx, 'e')
    
    # 1. Wrapped the UNION ALL in a subquery 'c'
    # 2. Joined branch 'b' on b_id
    # 3. Added b.location to SELECT and GROUP BY
    query = f"""
        SELECT 
            c.branch_id, 
            b.location,
            SUM(c.amount) as total_opex 
        FROM (
            SELECT ex.branch_id, SUM(ex.amount) as amount 
            FROM branch_expenses_record ex 
            WHERE 1=1 {ex_scope} 
            GROUP BY ex.branch_id
            
            UNION ALL
            
            SELECT e.branch_id, SUM(e.salary) as amount 
            FROM employee e 
            WHERE 1=1 {e_scope} 
            GROUP BY e.branch_id
        ) c
        JOIN branch b ON c.branch_id = b.b_id
        GROUP BY c.branch_id, b.location
    """
    
    df = pd.read_sql(query, engine)
    data = safe_to_dict(df.round(2))
    warnings = evaluate_warnings(data, 'total_opex', 4000000, 'greater', "Operating expenses exceeding safe limits")
    
    # Changed x='branch_id' to x='location' so the chart displays the name
    chart = generate_chart(df, 'bar', 'Total Branch OPEX', x='location', y='total_opex')
    
    return {"data": data, "warnings": warnings, "chart": chart}

def get_finance_employee_expenses(uid):
    ctx = get_user_context(uid)
    e_scope = get_finance_scope_filter(ctx, 'e')
    
    # 1. We create a subquery 'c' that unifies the expenses table and the employee salary column
    # 2. We hardcode 'salary' as an expense_type for the employee records
    # 3. We JOIN the branch table at the end to get the location names
    query = f"""
        SELECT 
            c.branch_id, 
            b.location,
            c.expense_type,
            SUM(c.amount) as total_employee_expenses 
        FROM (
            SELECT e.branch_id, ex.expense_type, SUM(ex.amount) as amount 
            FROM employee_expenses_record ex 
            JOIN employee e ON ex.employee_id = e.emp_id 
            WHERE 1=1 {e_scope} 
            GROUP BY e.branch_id, ex.expense_type
            
            UNION ALL
            
            SELECT e.branch_id, 'salary' as expense_type, SUM(e.salary) as amount 
            FROM employee e 
            WHERE 1=1 {e_scope} 
            GROUP BY e.branch_id
        ) c
        JOIN branch b ON c.branch_id = b.b_id
        GROUP BY c.branch_id, b.location, c.expense_type
    """
    
    df = pd.read_sql(query, engine)
    
    chart = generate_chart(
        df, 
        'bar', 
        'Employee Expenses Breakdown', 
        x='location', 
        y='total_employee_expenses', 
        color='expense_type'
    )
    
    return {"data": safe_to_dict(df.round(2)), "warnings": [], "chart": chart}

def get_finance_product_profitability(uid):
    ctx = get_user_context(uid)
    f_scope = get_finance_scope_filter(ctx, 'f')
    query = f"""
        SELECT f.branch_id, p.name, p.model, SUM((p.price_after_profit - p.price_before_profit) * f.amount) as total_profit 
        FROM financial_record f JOIN product p ON f.product_id = p.product_id 
        WHERE f.transaction_type = 'sale' {f_scope} 
        GROUP BY f.branch_id, p.name, p.model ORDER BY total_profit DESC LIMIT 10
    """
    df = pd.read_sql(query, engine)
    chart = generate_chart(df, 'leaderboard', 'Top Profitable Products', x='name', y='total_profit')
    return {"data": safe_to_dict(df.round(2)), "warnings": [], "chart": chart}


def get_finance_restock_costs(uid, target_year=None, target_month=None):
    ctx = get_user_context(uid)
    i_scope = get_finance_scope_filter(ctx, 'i')
    
    # 1. Default to the current month and year if the user hasn't selected one yet
    if not target_year or not target_month:
        now = pd.Timestamp.now()
        target_year = now.year
        target_month = now.month
        
    # 2. Add a date filter to the SQL query
    date_filter = f" AND YEAR(i.date) = {target_year} AND MONTH(i.date) = {target_month} "

    # 3. Join the branch table to get the location name
    query = f"""
        SELECT 
            i.branch_id, 
            b.location AS Name,
            SUM(i.quantity_changed * p.price_before_profit) as restock_cost
        FROM inventory_log i 
        JOIN product p ON i.product_id = p.product_id
        JOIN branch b ON i.branch_id = b.b_id
        WHERE i.type_of_change = 'out' 
        AND i.branch_id IS NOT NULL 
        {i_scope} {date_filter}
        GROUP BY i.branch_id, b.location
    """
    
    df = pd.read_sql(query, engine)
    data = safe_to_dict(df.round(2))
    
    # 4. Extract the exact values for the user's primary and secondary branches
    primary_branch_id = ctx.get('branch_id')
    secondary_branch_id = ctx.get('secondary_branch_id')
    
    primary_value = 0
    secondary_value = 0
    
    for row in data:
        # We cast to strings safely in case the IDs are stored as floats/ints
        if str(row['branch_id']) == str(primary_branch_id):
            primary_value = row['restock_cost']
        elif str(row['branch_id']) == str(secondary_branch_id):
            secondary_value = row['restock_cost']

    # 5. Changed to a Bar chart since we are looking at a single month snapshot
    chart_title = f'Restock Expenditure ({target_year}-{target_month:02d})'
    chart = generate_chart(df, 'bar', chart_title, x='Name', y='restock_cost')
    
    # 6. Return the isolated branch values so your UI can display them easily
    return {
        "data": data, 
        "warnings": [], 
        "chart": chart,
        "period": f"{target_year}-{target_month:02d}",
        "primary_branch_cost": primary_value,
        "secondary_branch_cost": secondary_value
    }


def get_finance_restock_storages(uid, target_year=None, target_month=None):
    ctx = get_user_context(uid)

    # Default to current month/year if not provided
    if not target_year or not target_month:
        now = pd.Timestamp.now()
        target_year = now.year
        target_month = now.month

    date_filter = f" AND YEAR(i.date) = {target_year} AND MONTH(i.date) = {target_month} "

    # Storage-level restock: type_of_change = 'restock', branch_id IS NULL, no grouping by branch
    query = f"""
        SELECT 
            SUM(i.quantity_changed * p.price_before_profit) as restock_cost
        FROM inventory_log i 
        JOIN product p ON i.product_id = p.product_id
        WHERE i.type_of_change = 'restock' 
        AND i.branch_id IS NULL 
        {date_filter}
    """

    df = pd.read_sql(query, engine)
    data = safe_to_dict(df.round(2))

    restock_cost = data[0]['restock_cost'] if data and data[0]['restock_cost'] is not None else 0

    chart_title = f'Storage Restock Cost ({target_year}-{target_month:02d})'
    # No branch grouping — single value, no chart needed
    return {
        "data": data,
        "warnings": [],
        "chart": None,
        "period": f"{target_year}-{target_month:02d}",
        "storage_restock_cost": restock_cost
    }


def get_finance_damage_impact(uid):
    ctx = get_user_context(uid)
    i_scope = get_finance_scope_filter(ctx, 'i')
    
    # 1. Joined the branch table using b_id
    # 2. Added b.location to the SELECT and GROUP BY clauses
    query = f"""
        SELECT 
            i.branch_id, 
            b.location,
            SUM(i.quantity_changed * p.price_before_profit) as lost_value
        FROM inventory_log i 
        JOIN product p ON i.product_id = p.product_id
        JOIN branch b ON i.branch_id = b.b_id
        WHERE i.type_of_change = 'damaged' {i_scope} 
        GROUP BY i.branch_id, b.location
    """
    
    df = pd.read_sql(query, engine)
    
    # Changed x='branch_id' to x='location' so the bar chart uses the actual names
    chart = generate_chart(df, 'bar', 'Lost Value from Damages', x='location', y='lost_value')
    
    return {"data": safe_to_dict(df.round(2)), "warnings": [], "chart": chart}

#change the name of this function get_finance_revenue_by_type to be get_finance_overview and update that in dashboard
def get_finance_overview(uid):
    ctx = get_user_context(uid)
    f_scope = get_finance_scope_filter(ctx, 'f')
    
    # 1. Joined the branch table using b_id
    # 2. Added b.location to the SELECT and GROUP BY clauses
    query = f"""
        SELECT 
            f.branch_id, 
            b.location,
            f.transaction_type, 
            SUM(f.price) as type_volume 
        FROM financial_record f 
        JOIN branch b ON f.branch_id = b.b_id
        WHERE 1=1 {f_scope} 
        GROUP BY f.branch_id, b.location, f.transaction_type
    """
    
    df = pd.read_sql(query, engine)
    
    # Note: Since this groups by transaction type, the pie chart will still show the split 
    # between sales, refunds, etc., but your Detailed Data Table will now include the location!
    chart = generate_chart(df, 'pie', 'Transaction Volume by Type', names='transaction_type', values='type_volume')
    
    return {"data": safe_to_dict(df.round(2)), "warnings": [], "chart": chart}

#====================================================================================
# NEW FORECASTING & COMPARISON FUNCTIONS
#====================================================================================

def get_finance_quarterly_revenue_forecast(uid):
    """Compares past quarter revenue to current and predicts quarter end revenue."""
    ctx = get_user_context(uid)
    f_scope = get_finance_scope_filter(ctx, 'f')
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
    
    # Calculate days passed in current quarter
    q_start = pd.Timestamp(curr_yr, 3 * curr_qtr - 2, 1)
    days_passed = max((today - q_start).days, 1)
    
    # Total days in quarter
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
            # Warning if projected revenue is 15% lower than historical average
            if proj_vol < avg_past * 0.85:
                warnings.append(f"WARNING: Projected branch revenue (${proj_vol:,.2f}) for Q{curr_qtr} is significantly below historical average (${avg_past:,.2f}).")
        
        # Prepare chart breakdown
        df.loc[curr_mask, 'type'] = 'Actual (So Far)'
        proj_row = pd.DataFrame([{'yr': curr_yr, 'qtr': curr_qtr, 'volume': max(proj_vol - curr_vol, 0), 'period': f'{curr_yr}-Q{curr_qtr}', 'type': 'Projected Remainder'}])
        df = pd.concat([df, proj_row], ignore_index=True)
        
    chart = generate_chart(df, 'bar', 'Quarterly Branch Revenue Forecast', x='period', y='volume', color='type')
    return {"data": safe_to_dict(df.round(2)), "warnings": warnings, "chart": chart}

#===============================================================================
# 4. EXECUTION WRAPPERS
#===============================================================================

def run_all_finance_metrics(user_id, restock_year=None, restock_month=None, restock_storage_year=None, restock_storage_month=None):
    results = {}
    basic_funcs = [
        get_finance_opex_breakdown,
        get_finance_branch_total_opex, get_finance_employee_expenses,
        get_finance_product_profitability,
        get_finance_damage_impact, get_finance_overview,
        get_finance_quarterly_revenue_forecast
    ]
    
    for func in basic_funcs:
        try: results[func.__name__] = func(user_id)
        except Exception as e: results[func.__name__] = {"data": [], "warnings": [f"Error: {str(e)}"], "chart": None}

    # Restock costs with optional date params
    try:
        results['get_finance_restock_costs'] = get_finance_restock_costs(user_id, restock_year, restock_month)
    except Exception as e:
        results['get_finance_restock_costs'] = {"data": [], "warnings": [f"Error: {str(e)}"], "chart": None}

    # Restock storages with optional date params
    try:
        results['get_finance_restock_storages'] = get_finance_restock_storages(user_id, restock_storage_year, restock_storage_month)
    except Exception as e:
        results['get_finance_restock_storages'] = {"data": [], "warnings": [f"Error: {str(e)}"], "chart": None}
            
    return results

#===============================================================================
# 5. NODE.JS EXECUTION BRIDGE & TESTING
#===============================================================================

if __name__ == "__main__":
    try:
        if len(sys.argv) > 1:
            emp_id = int(sys.argv[1])
        else:
            emp_id = 77583

        # Parse optional params from extra args
        restock_year = None
        restock_month = None
        restock_storage_year = None
        restock_storage_month = None
        for arg in sys.argv[2:]:
            if arg.startswith('restock_year='):
                try: restock_year = int(arg.split('=')[1])
                except: pass
            elif arg.startswith('restock_month='):
                try: restock_month = int(arg.split('=')[1])
                except: pass
            elif arg.startswith('restock_storage_year='):
                try: restock_storage_year = int(arg.split('=')[1])
                except: pass
            elif arg.startswith('restock_storage_month='):
                try: restock_storage_month = int(arg.split('=')[1])
                except: pass

        results = run_all_finance_metrics(emp_id, restock_year, restock_month, restock_storage_year, restock_storage_month)
        save_json_to_text(results, "finance_employee_output.txt")
        print(json.dumps(results, indent=4))

    except Exception as e:
        error_json = {"error": str(e)}
        save_json_to_text(error_json, "finance_error_log.txt")
        print(json.dumps(error_json, indent=4))