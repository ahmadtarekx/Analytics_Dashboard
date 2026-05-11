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
# 2. VALIDATION, UTILITIES & REGIONAL SCOPE
# ==========================================

def save_json_to_text(data, filename="pr_employee_output.txt"):
    """Saves the JSON results to a text file in the exact same folder as this script."""
    try:
        current_dir = os.path.dirname(os.path.abspath(__file__))
        file_path = os.path.join(current_dir, filename)
        with open(file_path, "w", encoding="utf-8") as f:
            json.dump(data, f, indent=4)
    except Exception as e:
        print(f"FAILED TO SAVE TEXT FILE: {e}", file=sys.stderr)

def get_user_context(user_id):
    """Validates user_id and fetches role, branch_id, and secondary_branch_id."""
    query = f"SELECT role, branch_id, secondary_branch_id, departement_id FROM employee WHERE emp_id = {user_id}"
    df = pd.read_sql(query, engine)
    if df.empty:
        raise ValueError(f"Access Denied: User ID {user_id} not found.")
    return df.iloc[0].to_dict()

def get_regional_scope_filter(context, table_alias='e'):
    """
    STRICT 2-BRANCH FILTER: 
    Limits this Board Member's view to their specific primary and secondary branches.
    """
    b_id = context.get('branch_id')
    sb_id = context.get('secondary_branch_id')
    
    valid_branches = []
    
    if pd.notna(b_id) and b_id is not None:
        valid_branches.append(str(int(float(b_id))))
        
    if pd.notna(sb_id) and sb_id is not None and str(sb_id).strip().upper() not in ['NULL', 'NONE', '']:
        valid_branches.append(str(int(float(sb_id))))
        
    if not valid_branches:
        return " AND 1=0 " # Failsafe
        
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
    """Scans returned data and generates actionable dashboard warnings."""
    warnings = []
    for row in data:
        val = row.get(metric_key)
        if pd.isna(val) or val is None:
            continue
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
# 3. REGIONAL BOARD MEMBER METRICS (CROSS-DEPARTMENTAL)
#====================================================================================

def get_my_personal_info(uid):
    ctx = get_user_context(uid)
    query = f"SELECT emp_id, First_Name, Last_Name, role, branch_id, secondary_branch_id FROM employee WHERE emp_id = {uid}"
    df = pd.read_sql(query, engine)
    return {"data": safe_to_dict(df), "warnings": [], "chart": None}

def get_regional_profitability_overview(uid):
    ctx = get_user_context(uid)
    f_scope = get_regional_scope_filter(ctx, 'f')
    e_scope = get_regional_scope_filter(ctx, 'e')
    ex_scope = get_regional_scope_filter(ctx, 'ex')
    
    rev_df = pd.read_sql(f"SELECT SUM(f.price) as revenue FROM financial_record f WHERE LOWER(f.transaction_type)='sale' {f_scope}", engine)
    revenue = rev_df['revenue'].iloc[0] or 0
    
    pay_df = pd.read_sql(f"SELECT SUM(e.salary) as payroll FROM employee e WHERE 1=1 {e_scope}", engine)
    payroll = pay_df['payroll'].iloc[0] or 0
    
    op_df = pd.read_sql(f"SELECT SUM(ex.amount) as opex FROM branch_expenses_record ex WHERE 1=1 {ex_scope}", engine)
    opex = op_df['opex'].iloc[0] or 0
    
    net_profit = revenue - (payroll + opex)
    
    data = [{"metric": "Gross Revenue", "value": round(revenue, 2)},
            {"metric": "Payroll Costs", "value": round(payroll, 2)},
            {"metric": "Operating Costs", "value": round(opex, 2)},
            {"metric": "Net Profit", "value": round(net_profit, 2)}]
    
    # Show only Net Profit by default; others visible on hover/select
    import plotly.graph_objects as go
    fig = go.Figure()
    colors = {"Gross Revenue": "#5b8fff", "Payroll Costs": "#f59e0b", "Operating Costs": "#ef4444", "Net Profit": "#10b981"}
    for row in data:
        visible = True if row["metric"] == "Net Profit" else "legendonly"
        fig.add_trace(go.Bar(
            name=row["metric"],
            x=[row["metric"]],
            y=[row["value"]],
            visible=visible,
            marker_color=colors.get(row["metric"], "#8aaad8")
        ))
    fig.update_layout(
        title="Regional Profitability",
        barmode="group",
        legend=dict(title="Click to toggle", orientation="h"),
    )
    chart = json.loads(fig.to_json())
    
    warnings = ["WARNING: Your assigned region is operating at a net loss!"] if net_profit < 0 else []
    return {"data": data, "warnings": warnings, "chart": chart}

def get_regional_workforce_summary(uid):
    ctx = get_user_context(uid)
    e_scope = get_regional_scope_filter(ctx, 'e')
    
    # 1. Added JOIN branch b ON b.b_id = e.branch_id
    # 2. Added b.location as name to the SELECT statement
    # 3. Added b.location to the GROUP BY clause
    query = f"""
        SELECT 
            e.branch_id, 
            b.location as name, 
            COUNT(e.emp_id) as Total_Headcount, 
            SUM(e.salary) as total_regional_payroll, 
            AVG(e.salary) as avg_regional_salary 
        FROM employee e 
        JOIN branch b ON b.b_id = e.branch_id
        WHERE 1=1 {e_scope} 
        GROUP BY e.branch_id, b.location
    """
    df = pd.read_sql(query, engine)
    
    # Updated the chart's x-axis to use 'name' instead of 'branch_id' for better UI readability
    chart = generate_chart(df, 'bar', 'Workforce Payroll by Branch', x='name', y='total_regional_payroll')
    
    return {"data": safe_to_dict(df.round(2)), "warnings": [], "chart": chart}

def get_regional_top_sales_performers(uid):
    ctx = get_user_context(uid)
    e_scope = get_regional_scope_filter(ctx, 'e')
    query = f"""
        SELECT e.emp_id, e.First_Name, e.Last_Name, e.branch_id, SUM(s.price) as revenue_generated 
        FROM employee_sales_log s 
        JOIN employee e ON s.employee_id = e.emp_id 
        WHERE 1=1 {e_scope} 
        GROUP BY e.emp_id, e.First_Name, e.Last_Name, e.branch_id
        ORDER BY revenue_generated DESC LIMIT 10
    """
    df = pd.read_sql(query, engine)
    return {"data": safe_to_dict(df.round(2)), "warnings": [], "chart": None}

def get_regional_inventory_capital(uid):
    ctx = get_user_context(uid)
    
    # FIX: Join a distinct list of products per branch from inventory_log (il)
    # AND join the branch table (b) to get the location name.
    il_scope = get_regional_scope_filter(ctx, 'il')
    query = f"""
        SELECT 
            il.branch_id, 
            b.location as name,
            SUM(p.amount_avail * p.price_before_profit) as tied_up_capital, 
            SUM(p.amount_avail) as total_physical_units 
        FROM product p 
        JOIN (SELECT DISTINCT branch_id, product_id FROM inventory_log) il 
            ON p.product_id = il.product_id 
        JOIN branch b 
            ON b.b_id = il.branch_id
        WHERE 1=1 {il_scope} 
        GROUP BY il.branch_id, b.location
    """
    
    df = pd.read_sql(query, engine)
    
    # Check if data exists before processing
    if df.empty:
        return {"data": [], "warnings": ["No inventory capital data found for your branches."], "chart": None}

    # Format the data for the frontend
    formatted_data = df.to_dict('records')
    
    warnings = []
    if df['tied_up_capital'].sum() > 500000: # Example threshold
        warnings.append("High capital tied up in inventory.")

    return {
        "data": formatted_data,
        "warnings": warnings,
        "chart": None 
    }
    

def get_regional_top_selling_assets(uid):
    ctx = get_user_context(uid)
    f_scope = get_regional_scope_filter(ctx, 'f')
    query = f"""
        SELECT p.name, p.type, SUM(f.amount) as total_units_sold, SUM(f.price) as gross_revenue 
        FROM financial_record f 
        JOIN product p ON f.product_id = p.product_id 
        WHERE LOWER(f.transaction_type)='sale' {f_scope} 
        GROUP BY p.product_id, p.name, p.type 
        ORDER BY gross_revenue DESC LIMIT 10
    """
    df = pd.read_sql(query, engine)
    return {"data": safe_to_dict(df.round(2)), "warnings": [], "chart": None}

def get_regional_critical_alerts(uid):
    ctx = get_user_context(uid)
    alerts = []
    warnings = [] # Decoupled red alerts
    
    # 1. High Expenses - Grouped by branch, restricted by ex_scope
    ex_scope = get_regional_scope_filter(ctx, 'ex')
    query = f"""
        SELECT b.b_id, b.location as name 
        FROM branch b 
        JOIN branch_expenses_record ex ON b.b_id = ex.branch_id 
        WHERE ex.amount > 900000 {ex_scope}
        GROUP BY b.b_id, b.location
    """
    exp_df = pd.read_sql(query, engine)
    
    if len(exp_df) > 0:
        branch_count = len(exp_df)
        
        # Short message for the Red Alert box
        short_msg = f"{branch_count} branches in your region have expenses exceeding $900,000."
        warnings.append(short_msg)
        
        # Detailed message with bullet points for the Data Table
        branch_details = "\n".join([f"• ID {row['b_id']} ({row['name']})" for _, row in exp_df.iterrows()])
        alerts.append({
            "issue": "High Expenses", 
            "details": f"{branch_count} regional branches exceeding limit:\n{branch_details}"
        })
        
    # 2. Local Stockouts (Kept as is, but mapped to warnings)
    il_scope = get_regional_scope_filter(ctx, 'il')
    stock_query = f"""
        SELECT COUNT(DISTINCT p.product_id) as count 
        FROM product p 
        JOIN inventory_log il ON p.product_id = il.product_id 
        WHERE p.amount_avail = 0 {il_scope}
    """
    stock_df = pd.read_sql(stock_query, engine)
    if stock_df['count'].iloc[0] > 0:
        msg = f"{stock_df['count'].iloc[0]} products are completely out of stock in your branches."
        warnings.append(msg)
        alerts.append({"issue": "Local Stockouts", "details": msg})
        
    # 3. IT Bottleneck (Kept as is, but mapped to warnings)
    e_scope = get_regional_scope_filter(ctx, 'e')
    ticket_df = pd.read_sql(f"SELECT COUNT(*) as count FROM ticket t JOIN employee e ON t.employee_id = e.emp_id WHERE 1=1 {e_scope}", engine)
    if ticket_df['count'].iloc[0] > 10:
        msg = f"Your region has {ticket_df['count'].iloc[0]} unresolved support tickets."
        warnings.append(msg)
        alerts.append({"issue": "IT Bottleneck", "details": msg})
        
    return {"data": alerts, "warnings": warnings, "chart": None}

def get_regional_attendance_health(uid):
    ctx = get_user_context(uid)
    e_scope = get_regional_scope_filter(ctx, 'e')
    
    # 1. Added JOIN branch br ON br.b_id = e.branch_id
    # 2. Added br.location as name
    # 3. Added br.location to GROUP BY
    query = f"""
        SELECT 
            e.branch_id, 
            br.location as name,
            AVG(b.sick_days) as avg_sick_days, 
            AVG(b.upl) as avg_unpaid_leave 
        FROM adherence_balance b 
        JOIN employee e ON b.employee_id = e.emp_id 
        JOIN branch br ON br.b_id = e.branch_id
        WHERE 1=1 {e_scope} 
        GROUP BY e.branch_id, br.location
    """
    df = pd.read_sql(query, engine)
    
    # Optional but recommended: Change x='branch_id' to x='name' 
    # so your chart labels show the actual branch names instead of just numbers!
    chart = generate_chart(df, 'bar', 'Regional Absenteeism Health', x='name', y='avg_sick_days')
    
    return {"data": safe_to_dict(df.round(2)), "warnings": [], "chart": chart}

def get_regional_expense_breakdown(uid):
    ctx = get_user_context(uid)
    ex_scope = get_regional_scope_filter(ctx, 'ex')
    query = f"""
        SELECT ex.branch_id, ex.expense_type, SUM(ex.amount) as total_spent 
        FROM branch_expenses_record ex 
        WHERE 1=1 {ex_scope} 
        GROUP BY ex.branch_id, ex.expense_type
    """
    df = pd.read_sql(query, engine)
    chart = generate_chart(df, 'pie', 'Regional OPEX Distribution', names='expense_type', values='total_spent')
    return {"data": safe_to_dict(df.round(2)), "warnings": [], "chart": chart}


#====================================================================================
# NEW SCHEMA FUNCTIONS: 14-MONTH TRENDS & FORECASTING
#====================================================================================

def get_regional_sales_trends(uid):
    """Tracks regional monthly revenue over the last 14 months."""
    ctx = get_user_context(uid)
    e_scope = get_regional_scope_filter(ctx, 'e')
    query = f"""
        SELECT CONCAT(YEAR(s.transaction_date), '-', LPAD(MONTH(s.transaction_date), 2, '0')) as month, SUM(s.price) as revenue 
        FROM employee_sales_log s 
        JOIN employee e ON s.employee_id = e.emp_id 
        WHERE s.transaction_date >= DATE_SUB(CURDATE(), INTERVAL 16 MONTH) {e_scope} 
        GROUP BY month ORDER BY month ASC
    """
    df = pd.read_sql(query, engine)
    chart = generate_chart(df, 'line', '16-Month Regional Revenue Trend', x='month', y='revenue')
    return {"data": safe_to_dict(df.round(2)), "warnings": [], "chart": chart}

def get_regional_quarterly_revenue_forecast(uid):
    """Predicts quarter end revenue for the assigned branches based on current pacing."""
    ctx = get_user_context(uid)
    e_scope = get_regional_scope_filter(ctx, 'e')
    query = f"""
        SELECT YEAR(s.transaction_date) as yr, QUARTER(s.transaction_date) as qtr, SUM(s.price) as volume 
        FROM employee_sales_log s 
        JOIN employee e ON s.employee_id = e.emp_id 
        WHERE 1=1 {e_scope} GROUP BY yr, qtr ORDER BY yr, qtr
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
                warnings.append(f"WARNING: Projected regional revenue (${proj_vol:,.2f}) for Q{curr_qtr} is pacing poorly compared to the historical average (${avg_past:,.2f}).")
        
        df.loc[curr_mask, 'type'] = 'Actual (So Far)'
        proj_row = pd.DataFrame([{'yr': curr_yr, 'qtr': curr_qtr, 'volume': max(proj_vol - curr_vol, 0), 'period': f'{curr_yr}-Q{curr_qtr}', 'type': 'Projected Remainder'}])
        df = pd.concat([df, proj_row], ignore_index=True)
        
    chart = generate_chart(df, 'bar', 'Quarterly Regional Revenue Forecast', x='period', y='volume', color='type')
    return {"data": safe_to_dict(df.round(2)), "warnings": warnings, "chart": chart}

#===============================================================================
# 4. EXECUTION WRAPPERS
#===============================================================================

def run_all_pr_board_member_metrics(user_id):
    """Executes all Regional Executive metrics for the Board Member."""
    results = {}
    pr_funcs = [
        get_my_personal_info,
        get_regional_profitability_overview,
        get_regional_workforce_summary,
        get_regional_top_sales_performers,
        get_regional_inventory_capital,
        get_regional_top_selling_assets,
        get_regional_critical_alerts,
        get_regional_attendance_health,
        get_regional_expense_breakdown,
        get_regional_sales_trends,
        get_regional_quarterly_revenue_forecast
    ]
    
    for func in pr_funcs:
        try: results[func.__name__] = func(user_id)
        except Exception as e: results[func.__name__] = {"data": [], "warnings": [f"Error: {str(e)}"], "chart": None}
            
    return results

#===============================================================================
# 5. NODE.JS EXECUTION BRIDGE & TESTING
#===============================================================================

if __name__ == "__main__":
    try:
        # 1. Check if Node.js passed the arguments
        if len(sys.argv) > 1:
            emp_id = int(sys.argv[1])
        else:
            # 2. Fallback for your local testing 
            emp_id = 95523 

        # 3. Execute the metrics
        results = run_all_pr_board_member_metrics(emp_id) 

        # --- NEW: Save the output to a text file ---
        save_json_to_text(results, "pr_employee_output.txt")

        # 4. Print as formatted JSON so it's readable in the terminal
        print(json.dumps(results, indent=4))

    except Exception as e:
        error_json = {"error": str(e)}
        save_json_to_text(error_json, "pr_employee_error_log.txt")
        print(json.dumps(error_json, indent=4))