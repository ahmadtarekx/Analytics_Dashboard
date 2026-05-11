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
# 2. VALIDATION & UTILITIES
# ==========================================

def save_json_to_text(data, filename="pr_manager_output.txt"):
    try:
        current_dir = os.path.dirname(os.path.abspath(__file__))
        file_path = os.path.join(current_dir, filename)
        with open(file_path, "w", encoding="utf-8") as f:
            json.dump(data, f, indent=4)
    except Exception as e:
        print(f"FAILED TO SAVE TEXT FILE: {e}", file=sys.stderr)

def get_user_context(user_id):
    """Validates user_id and fetches role, branch_id, secondary_branch_id, and departement_id."""
    query = f"SELECT role, branch_id, secondary_branch_id, departement_id FROM employee WHERE emp_id = {user_id}"
    df = pd.read_sql(query, engine)
    if df.empty:
        raise ValueError(f"Access Denied: User ID {user_id} not found.")
    return df.iloc[0].to_dict()

def require_ceo(context):
    """Blocks execution if the user is not the CEO/Executive Board Manager."""
    current_role = str(context.get('role', '')).lower()
    allowed_roles = ['ceo', 'dep_manager', 'global_manager', 'admin']
    if current_role not in allowed_roles:
        raise PermissionError(f"Access Denied: Your role is '{current_role}'. Executive access required.")

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
# 3. CEO / EXECUTIVE BOARD METRICS (GLOBAL SCOPE)
#====================================================================================



def get_ceo_company_net_profit_estimate(uid):
    require_ceo(get_user_context(uid))
    
    rev_df = pd.read_sql("SELECT SUM(price) as gross_revenue FROM employee_sales_log", engine)
    gross_revenue = rev_df['gross_revenue'].iloc[0] or 0
    
    payroll_df = pd.read_sql("SELECT SUM(salary) as total_payroll FROM employee", engine)
    b_exp_df = pd.read_sql("SELECT SUM(amount) as branch_expenses FROM branch_expenses_record", engine)
    e_exp_df = pd.read_sql("SELECT SUM(amount) as emp_expenses FROM employee_expenses_record", engine)
    
    total_costs = (payroll_df['total_payroll'].iloc[0] or 0) + \
                  (b_exp_df['branch_expenses'].iloc[0] or 0) + \
                  (e_exp_df['emp_expenses'].iloc[0] or 0)
                  
    net_profit = gross_revenue - total_costs
    
    data = [{"metric": "Gross Revenue", "value": round(gross_revenue, 2)}, 
            {"metric": "Total Costs", "value": round(total_costs, 2)}, 
            {"metric": "Net Profit Estimate", "value": round(net_profit, 2)}]
    
    # Show only Net Profit Estimate by default; others visible on hover/select
    df_chart = pd.DataFrame([{"metric": "Net Profit Estimate", "value": round(net_profit, 2)}])
    import plotly.graph_objects as go
    fig = go.Figure()
    colors = {"Gross Revenue": "#5b8fff", "Total Costs": "#ef4444", "Net Profit Estimate": "#10b981"}
    for row in data:
        visible = True if row["metric"] == "Net Profit Estimate" else "legendonly"
        fig.add_trace(go.Bar(
            name=row["metric"],
            x=[row["metric"]],
            y=[row["value"]],
            visible=visible,
            marker_color=colors.get(row["metric"], "#8aaad8")
        ))
    fig.update_layout(
        title="Company Financial Health",
        barmode="group",
        legend=dict(title="Click to toggle", orientation="h"),
    )
    chart = json.loads(fig.to_json())
    
    warnings = ["CRITICAL: Company is operating at a loss!"] if net_profit < 0 else []
    return {"data": data, "warnings": warnings, "chart": chart}



def get_ceo_branch_leaderboard(uid):
    require_ceo(get_user_context(uid))
    query = """
        SELECT e.branch_id, b.location as name, SUM(s.price) as total_revenue, COUNT(s.record_id) as total_transactions 
        FROM employee_sales_log s 
        JOIN employee e ON s.employee_id = e.emp_id 
        JOIN branch b ON b.b_id = e.branch_id
        GROUP BY e.branch_id, b.location
        ORDER BY total_revenue DESC
    """
    df = pd.read_sql(query, engine)
    return {"data": safe_to_dict(df.round(2)), "warnings": [], "chart": None}

def get_ceo_workforce_overview(uid):
    require_ceo(get_user_context(uid))
    query = """
        SELECT 
            COUNT(emp_id) as total_headcount, 
            SUM(salary) as annual_payroll_burden, 
            AVG(salary) as average_salary,
            AVG(TIMESTAMPDIFF(YEAR, hired, CURDATE())) as average_company_tenure
        FROM employee
    """
    df = pd.read_sql(query, engine)
    return {"data": safe_to_dict(df.round(2)), "warnings": [], "chart": None}



def get_ceo_department_cost_analysis(uid):
    require_ceo(get_user_context(uid))
    query = """
        SELECT d.name as department_name, departement_id, COUNT(emp_id) as headcount, SUM(salary) as department_payroll 
        FROM employee e
        LEFT JOIN departement d ON e.departement_id = d.dep_id
        GROUP BY departement_id, d.name
        ORDER BY department_payroll DESC
    """
    df = pd.read_sql(query, engine)
    chart = generate_chart(df, 'pie', 'Total Payroll Burden by Department', names='department_name', values='department_payroll')
    return {"data": safe_to_dict(df.round(2)), "warnings": [], "chart": chart}

def get_ceo_inventory_capital_tied_up(uid):
    require_ceo(get_user_context(uid))
    query = "SELECT SUM(amount_avail * price_before_profit) as total_inventory_cost FROM product"
    df = pd.read_sql(query, engine)
    return {"data": safe_to_dict(df.round(2)), "warnings": [], "chart": None}



def get_ceo_top_company_assets(uid):
    require_ceo(get_user_context(uid))
    query = """
        SELECT p.name, p.model, SUM(esl.amount) as total_sold, SUM(esl.price) as revenue_generated 
        FROM employee_sales_log esl 
        JOIN product_sold_log psl ON esl.record_id = psl.record_id 
        JOIN product p ON psl.product_id = p.product_id 
        GROUP BY p.product_id, p.name, p.model 
        ORDER BY revenue_generated DESC LIMIT 5
    """
    df = pd.read_sql(query, engine)
    return {"data": safe_to_dict(df.round(2)), "warnings": [], "chart": None}

def get_ceo_critical_operational_alerts(uid):
    require_ceo(get_user_context(uid))
    alerts = []
    warnings = [] 
    
    query = """
        SELECT b.b_id, b.location as name 
        FROM branch b 
        JOIN branch_expenses_record e ON b.b_id = e.branch_id 
        WHERE e.amount > 900000 
        GROUP BY b.b_id, b.location
    """
    
    exp_df = pd.read_sql(query, engine)
    
    if len(exp_df) > 0:
        branch_count = len(exp_df)
        
        # 1. The short message for the Red Alert box
        short_msg = f"{branch_count} branches have expenses exceeding 900,000 limit."
        warnings.append(short_msg)
        
        # 2. Format the detailed message with newlines (\n) and bullet points (•)
        branch_details = "\n".join([f"• ID {row['b_id']} ({row['name']})" for _, row in exp_df.iterrows()])
        
        alerts.append({
            "issue": "High Expenses", 
            "details": f"{branch_count} branches exceeding limit:\n{branch_details}"
        })
        
    stock_df = pd.read_sql("SELECT COUNT(*) as count FROM product WHERE amount_avail = 0", engine)
    if stock_df['count'].iloc[0] > 0:
        msg = f"{stock_df['count'].iloc[0]} product lines are completely out of stock."
        warnings.append(msg)
        alerts.append({"issue": "Stockouts", "details": msg})
        
    ticket_df = pd.read_sql("SELECT COUNT(*) as count FROM ticket", engine)
    if ticket_df['count'].iloc[0] > 50:
        msg = f"Company has {ticket_df['count'].iloc[0]} unresolved tickets."
        warnings.append(msg)
        alerts.append({"issue": "IT Bottleneck", "details": msg})
        
    return {"data": alerts, "warnings": warnings, "chart": None}

def get_ceo_company_attendance_health(uid):
    require_ceo(get_user_context(uid))
    query = """
        SELECT 
            AVG(sick_days) as avg_sick_days_taken, 
            AVG(upl) as avg_unpaid_leave_days 
        FROM adherence_balance
    """
    df = pd.read_sql(query, engine)
    return {"data": safe_to_dict(df.round(2)), "warnings": [], "chart": None}

#====================================================================================
# NEW SCHEMA FUNCTIONS: 14-MONTH TRENDS & FORECASTING
#====================================================================================

def get_ceo_company_sales_trends(uid):
    """Tracks global monthly revenue over the last 14 months."""
    require_ceo(get_user_context(uid))
    query = """
        SELECT CONCAT(YEAR(transaction_date), '-', LPAD(MONTH(transaction_date), 2, '0')) as month, SUM(price) as revenue 
        FROM employee_sales_log 
        WHERE transaction_date >= DATE_SUB(CURDATE(), INTERVAL 16 MONTH) 
        GROUP BY month ORDER BY month ASC
    """
    df = pd.read_sql(query, engine)
    chart = generate_chart(df, 'line', '14-Month Global Revenue Trend', x='month', y='revenue')
    return {"data": safe_to_dict(df.round(2)), "warnings": [], "chart": chart}

def get_ceo_quarterly_revenue_forecast(uid):
    """Predicts quarter end global revenue based on current pacing."""
    require_ceo(get_user_context(uid))
    query = """
        SELECT YEAR(transaction_date) as yr, QUARTER(transaction_date) as qtr, SUM(price) as volume 
        FROM employee_sales_log GROUP BY yr, qtr ORDER BY yr, qtr
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
                warnings.append(f"WARNING: Projected global revenue (${proj_vol:,.2f}) for Q{curr_qtr} is pacing poorly compared to historical average (${avg_past:,.2f}).")
        
        df.loc[curr_mask, 'type'] = 'Actual (So Far)'
        proj_row = pd.DataFrame([{'yr': curr_yr, 'qtr': curr_qtr, 'volume': max(proj_vol - curr_vol, 0), 'period': f'{curr_yr}-Q{curr_qtr}', 'type': 'Projected Remainder'}])
        df = pd.concat([df, proj_row], ignore_index=True)
        
    chart = generate_chart(df, 'bar', 'Quarterly Global Revenue Forecast', x='period', y='volume', color='type')
    return {"data": safe_to_dict(df.round(2)), "warnings": warnings, "chart": chart}

#===============================================================================
# 4. EXECUTION WRAPPERS
#===============================================================================

def run_all_ceo_metrics(user_id):
    """Executes all Global Executive / CEO metrics."""
    results = {}
    ceo_funcs = [
        get_ceo_company_net_profit_estimate,
        get_ceo_branch_leaderboard,
        get_ceo_workforce_overview,
        get_ceo_department_cost_analysis,
        get_ceo_inventory_capital_tied_up,
        get_ceo_top_company_assets,
        get_ceo_critical_operational_alerts,
        get_ceo_company_attendance_health,
        get_ceo_company_sales_trends,
        get_ceo_quarterly_revenue_forecast
    ]
    
    for func in ceo_funcs:
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
            emp_id = 91949 

        # 3. Execute the metrics
        results = run_all_ceo_metrics(emp_id) 

        # --- NEW: Save the output to a text file ---
        save_json_to_text(results, "pr_manager_output.txt")

        # 4. Print as formatted JSON so it's readable in the terminal
        print(json.dumps(results, indent=4))

    except Exception as e:
        error_json = {"error": str(e)}
        save_json_to_text(error_json, "pr_manager_error_log.txt")
        print(json.dumps(error_json, indent=4))