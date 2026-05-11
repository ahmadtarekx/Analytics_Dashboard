import warnings
warnings.filterwarnings('ignore')
import logging
logging.disable(logging.CRITICAL)
import os
os.environ['PYTHONWARNINGS'] = 'ignore'
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
    user     = os.getenv("DB_USER",     "root")
    password = os.getenv("DB_PASSWORD", "samka1234")
    host     = os.getenv("DB_HOST",     "localhost")
    database = os.getenv("DB_NAME",     "mydb")
    return create_engine(f"mysql+pymysql://{user}:{password}@{host}/{database}", echo=False, pool_pre_ping=False)

engine = get_db_engine()

# ==========================================
# 2. VALIDATION, UTILITIES & TEAM SCOPE
# ==========================================

def save_json_to_text(data, filename="sales_leader_output.txt"):
    try:
        path = os.path.join(os.path.dirname(os.path.abspath(__file__)), filename)
        with open(path, "w", encoding="utf-8") as f:
            json.dump(data, f, indent=4)
    except Exception as e:
        print(f"FAILED TO SAVE TEXT FILE: {e}", file=sys.stderr)

def get_user_context(user_id):
    """Validates user_id and fetches role, branch_id, secondary_branch_id."""
    query = f"SELECT role, branch_id, secondary_branch_id, departement_id FROM employee WHERE emp_id = {user_id}"
    df = pd.read_sql(query, engine)
    if df.empty:
        raise ValueError(f"Access Denied: User ID {user_id} not found.")
    return df.iloc[0].to_dict()

def require_team_leader(context):
    """Blocks execution if the user is not at least a Team Leader."""
    current_role = str(context.get('role', '')).lower()
    allowed_roles = ['leader', 'sales_manager', 'dep_manager', 'manager', 'admin']
    if current_role not in allowed_roles:
        raise PermissionError(
            f"Access Denied: Your role is '{current_role}'. You need to be a Team Leader or Manager."
        )

def get_team_scope_filter(context, table_alias='s'):
    """STRICT BRANCH SCOPE: Limits all queries to the Team Leader's assigned branch(es)."""
    b_id  = context.get('branch_id')
    sb_id = context.get('secondary_branch_id')
    valid_branches = []

    if pd.notna(b_id) and b_id is not None:
        valid_branches.append(str(int(float(b_id))))
    if pd.notna(sb_id) and sb_id is not None and str(sb_id).strip().upper() not in ['NULL', 'NONE', '']:
        valid_branches.append(str(int(float(sb_id))))

    if not valid_branches:
        return " AND 1=0 "  # Failsafe: block everything

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
        if val is None or (isinstance(val, float) and pd.isna(val)):
            continue
        try:
            fval = float(val)
        except (TypeError, ValueError):
            continue
        if condition == 'less' and fval < threshold:
            warnings.append(f"WARNING: {alert_msg} ({val})")
        elif condition == 'greater' and fval > threshold:
            warnings.append(f"WARNING: {alert_msg} ({val})")
    return warnings

def generate_chart(df, chart_type, title, x=None, y=None, names=None, values=None, color=None, **kwargs):
    if df.empty:
        return None
    
    df_plot = df.copy()
    
    # Convert ID columns to strings so Plotly treats them as categories, not continuous numbers
    for col in [x, names]:
        if col and col in df_plot.columns and df_plot[col].dtype in ['int64', 'float64'] and 'id' in col.lower():
            df_plot[col] = df_plot[col].astype(str)
            
    try:
        # Pass **kwargs to all px functions to support hover_data, labels, etc.
        if   chart_type == 'bar':  
            fig = px.bar(df_plot,  x=x,     y=y,     color=color, title=title, **kwargs)
        elif chart_type == 'pie':  
            fig = px.pie(df_plot,  names=names, values=values, color=color, title=title, **kwargs)
        elif chart_type == 'line': 
            fig = px.line(df_plot, x=x,     y=y,     color=color, title=title, **kwargs)
        else: 
            return None
            
        return json.loads(fig.to_json())
    except Exception as e:
        # It's usually a good idea to print or log the exception temporarily if you are debugging
        # print(f"Chart generation error: {e}") 
        return None

# ==========================================
# 3. TEAM LEADER SPECIFIC FUNCTIONS (Branch-Scoped)
# ==========================================

def get_team_total_revenue(uid):
    """Total revenue for this Team Leader's branch (all time)."""
    ctx     = get_user_context(uid)
    require_team_leader(ctx)
    s_scope = get_team_scope_filter(ctx, 's')
    query   = f"SELECT SUM(s.price) as team_revenue FROM employee_sales_log s WHERE 1=1 {s_scope}"
    df      = pd.read_sql(query, engine)
    return {"data": safe_to_dict(df.round(2)), "warnings": [], "chart": None}

def get_team_sales_leaderboard(uid):
    """Ranks employees in this branch by total all-time sales."""
    ctx     = get_user_context(uid)
    require_team_leader(ctx)
    s_scope = get_team_scope_filter(ctx, 's')
    query   = f"""
        SELECT e.emp_id, e.First_Name, e.Last_Name,
               SUM(s.price) as total_sales, COUNT(s.record_id) as deals_closed
        FROM employee_sales_log s
        JOIN employee e ON s.employee_id = e.emp_id
        WHERE 1=1 {s_scope}
          AND e.role != 'dep_manager'
        GROUP BY e.emp_id, e.First_Name, e.Last_Name
        ORDER BY total_sales DESC LIMIT 10
    """
    df = pd.read_sql(query, engine)
    # Leaderboard rule: ranking people → no chart, signal leaderboard UI
    return {"data": safe_to_dict(df.round(2)), "warnings": [], "chart": None, "chart_type": "leaderboard"}


# Now supports year/month selection. Returns chart_type='leaderboard' — renders as Leaderboard UI, not a chart.
def get_team_monthly_leaderboard(uid, year=None, month=None):
    """Ranks employees in this branch by sales for the chosen month (default: current month)."""
    ctx     = get_user_context(uid)
    require_team_leader(ctx)
    s_scope = get_team_scope_filter(ctx, 's')
    today   = date.today()
    yr      = int(year)  if year  else today.year
    mo      = int(month) if month else today.month
    query   = f"""
        SELECT e.emp_id, e.First_Name, e.Last_Name,
               COALESCE(SUM(s.price), 0) as total_sales,
               COUNT(s.record_id) as deals_closed
        FROM employee e
        LEFT JOIN employee_sales_log s ON s.employee_id = e.emp_id
            AND YEAR(s.transaction_date) = {yr}
            AND MONTH(s.transaction_date) = {mo}
        WHERE e.role != 'dep_manager' {s_scope.replace('s.branch_id', 'e.branch_id')}
        GROUP BY e.emp_id, e.First_Name, e.Last_Name
        ORDER BY total_sales DESC LIMIT 10
    """
    df          = pd.read_sql(query, engine)
    month_label = f"{calendar.month_name[mo]} {yr}"
    # Leaderboard rule: ranking people → no chart, signal leaderboard UI
    return {"data": safe_to_dict(df.round(2)), "warnings": [], "chart": None, "chart_type": "leaderboard", "period": month_label}

def get_team_bottom_performers(uid):
    """Identifies branch reps with lowest sales — coaching candidates. Returns as alert, not a chart."""
    ctx     = get_user_context(uid)
    require_team_leader(ctx)
    s_scope = get_team_scope_filter(ctx, 's')
    query   = f"""
        SELECT e.emp_id, e.First_Name, e.Last_Name,
               SUM(s.price) as total_sales, COUNT(s.record_id) as deals_closed
        FROM employee_sales_log s
        JOIN employee e ON s.employee_id = e.emp_id
        WHERE 1=1 {s_scope}
          AND e.role != 'dep_manager'
        GROUP BY e.emp_id, e.First_Name, e.Last_Name
        ORDER BY total_sales ASC LIMIT 3
    """
    df       = pd.read_sql(query, engine)
    data     = safe_to_dict(df.round(2))
    warnings = evaluate_warnings(data, 'total_sales', 500, 'less',
                                  "Rep has very low sales volume. Coaching recommended.")
    # Task 1: bottom performers shown as Alert component, not a chart
    return {"data": data, "warnings": warnings, "chart": None, "chart_type": "alert"}


def get_team_top_selling_products(uid):
    """Top products by revenue at this branch. Includes price, type, and model in hover data."""
    ctx     = get_user_context(uid)
    require_team_leader(ctx)
    s_scope = get_team_scope_filter(ctx, 's')
    query   = f"""
        SELECT p.product_id, p.name, p.model, p.type, p.price_after_profit AS unit_price,
               SUM(s.price) as local_revenue, SUM(s.amount) as local_units_sold
        FROM employee_sales_log s
        JOIN product_sold_log psl ON s.record_id = psl.record_id
        JOIN product p ON psl.product_id = p.product_id
        WHERE 1=1 {s_scope}
        GROUP BY p.product_id, p.name, p.model, p.type, p.price_after_profit
        ORDER BY local_revenue DESC LIMIT 5
    """
    df    = pd.read_sql(query, engine)
    # hover_data shows model and type for context
    chart = generate_chart(df, 'bar', 'Top Products at Branch', x='name', y='local_revenue', color='type', hover_data=['model', 'unit_price'])
    return {"data": safe_to_dict(df.round(2)), "warnings": [], "chart": chart}

def get_team_category_breakdown(uid):
    """Product category mix at this branch."""
    ctx     = get_user_context(uid)
    require_team_leader(ctx)
    s_scope = get_team_scope_filter(ctx, 's')
    query   = f"""
        SELECT p.type, SUM(s.price) as category_revenue
        FROM employee_sales_log s
        JOIN product_sold_log psl ON s.record_id = psl.record_id
        JOIN product p ON psl.product_id = p.product_id
        WHERE 1=1 {s_scope}
        GROUP BY p.type ORDER BY category_revenue DESC
    """
    df    = pd.read_sql(query, engine)
    chart = generate_chart(df, 'pie', 'Branch Sales by Category',
                           names='type', values='category_revenue')
    return {"data": safe_to_dict(df.round(2)), "warnings": [], "chart": chart}

def get_team_average_deal_size(uid):
    """Average transaction value for this branch."""
    ctx     = get_user_context(uid)
    require_team_leader(ctx)
    s_scope = get_team_scope_filter(ctx, 's')
    query   = f"SELECT AVG(s.price) as team_avg_order_value FROM employee_sales_log s WHERE 1=1 {s_scope}"
    df      = pd.read_sql(query, engine)
    return {"data": safe_to_dict(df.round(2)), "warnings": [], "chart": None}

def get_team_recent_transactions(uid):
    """Last 10 transactions at this branch — rendered as a leaderboard/table in the UI."""
    ctx     = get_user_context(uid)
    require_team_leader(ctx)
    s_scope = get_team_scope_filter(ctx, 's')
    query   = f"""
        SELECT s.record_id, e.First_Name, e.Last_Name,
               p.name as product_name, p.model, p.type,
               s.amount, s.price, s.transaction_date
        FROM employee_sales_log s
        JOIN employee e ON s.employee_id = e.emp_id
        JOIN product_sold_log psl ON s.record_id = psl.record_id
        JOIN product p ON psl.product_id = p.product_id
        WHERE 1=1 {s_scope}
        ORDER BY s.transaction_date DESC LIMIT 10
    """
    df = pd.read_sql(query, engine)
    # Task 1: recent transactions → Leaderboard UI, not a chart
    return {"data": safe_to_dict(df), "warnings": [], "chart": None, "chart_type": "leaderboard"}

def get_team_sales_trends(uid):
    """Monthly revenue trend for this branch over the last 14 months."""
    ctx     = get_user_context(uid)
    require_team_leader(ctx)
    s_scope = get_team_scope_filter(ctx, 's')
    query   = f"""
        SELECT CONCAT(YEAR(s.transaction_date), '-',
                      LPAD(MONTH(s.transaction_date), 2, '0')) as month,
               SUM(s.price) as revenue
        FROM employee_sales_log s
        WHERE s.transaction_date >= DATE_SUB(CURDATE(), INTERVAL 14 MONTH) {s_scope}
        GROUP BY month ORDER BY month ASC
    """
    df    = pd.read_sql(query, engine)
    chart = generate_chart(df, 'line', '14-Month Branch Revenue Trend', x='month', y='revenue')
    return {"data": safe_to_dict(df.round(2)), "warnings": [], "chart": chart}

def get_team_quarterly_sales_forecast(uid):
    """Predicts quarter-end revenue for this branch based on current pacing."""
    ctx     = get_user_context(uid)
    require_team_leader(ctx)
    s_scope = get_team_scope_filter(ctx, 's')
    query   = f"""
        SELECT YEAR(s.transaction_date) as yr,
               QUARTER(s.transaction_date) as qtr,
               SUM(s.price) as volume
        FROM employee_sales_log s
        WHERE 1=1 {s_scope}
        GROUP BY yr, qtr ORDER BY yr, qtr
    """
    df = pd.read_sql(query, engine)

    if df.empty:
        return {"data": [], "warnings": [], "chart": None}

    today    = pd.Timestamp.now()
    curr_yr  = today.year
    curr_qtr = today.quarter
    q_start  = pd.Timestamp(curr_yr, 3 * curr_qtr - 2, 1)
    days_passed = max((today - q_start).days, 1)

    if   curr_qtr == 1: total_days = 90 if calendar.isleap(curr_yr) else 89
    elif curr_qtr == 2: total_days = 91
    else:               total_days = 92

    multiplier = total_days / days_passed
    warnings   = []

    df['period'] = df['yr'].astype(str) + '-Q' + df['qtr'].astype(str)
    df['type']   = 'Actual'

    curr_mask = (df['yr'] == curr_yr) & (df['qtr'] == curr_qtr)
    if curr_mask.any():
        curr_vol = df.loc[curr_mask, 'volume'].values[0]
        proj_vol = float(curr_vol * multiplier)
        past_vols = df.loc[~curr_mask, 'volume']
        if not past_vols.empty:
            avg_past = past_vols.mean()
            if proj_vol < avg_past * 0.85:
                warnings.append(
                    f"WARNING: Projected team revenue ({proj_vol:,.2f} EGP) for Q{curr_qtr} "
                    f"is pacing poorly vs. historical average ({avg_past:,.2f} EGP)."
                )
        df.loc[curr_mask, 'type'] = 'Actual (So Far)'
        proj_row = pd.DataFrame([{
            'yr': curr_yr, 'qtr': curr_qtr,
            'volume': max(proj_vol - curr_vol, 0),
            'period': f'{curr_yr}-Q{curr_qtr}',
            'type':   'Projected Remainder'
        }])
        df = pd.concat([df, proj_row], ignore_index=True)

    chart = generate_chart(df, 'bar', 'Quarterly Branch Revenue Forecast',
                           x='period', y='volume', color='type')
    return {"data": safe_to_dict(df.round(2)), "warnings": warnings, "chart": chart}

# ==========================================
# 4. EXECUTION WRAPPER
# ==========================================

def run_all_team_leader_metrics(user_id, leaderboard_year=None, leaderboard_month=None):
    """Executes all Team Leader (branch-scoped) metrics."""
    results   = {}
    plain_funcs = [
        get_team_total_revenue,
        get_team_sales_leaderboard,
        get_team_bottom_performers,
        get_team_top_selling_products,
        get_team_category_breakdown,
        get_team_average_deal_size,
        get_team_recent_transactions,
        get_team_sales_trends,
        get_team_quarterly_sales_forecast,
    ]
    for func in plain_funcs:
        try:
            results[func.__name__] = func(user_id)
        except Exception as e:
            results[func.__name__] = {"data": [], "warnings": [f"Error: {str(e)}"], "chart": None}

    try:
        results['get_team_monthly_leaderboard'] = get_team_monthly_leaderboard(
            user_id,
            year=int(leaderboard_year) if leaderboard_year else None,
            month=int(leaderboard_month) if leaderboard_month else None,
        )
    except Exception as e:
        results['get_team_monthly_leaderboard'] = {"data": [], "warnings": [f"Error: {str(e)}"], "chart": None}

    return results

# ==========================================
# 5. NODE.JS EXECUTION BRIDGE
# ==========================================
if __name__ == "__main__":
    # Redirect stdout to stderr during script execution to catch any stray prints
    # Only the final json.dumps will go to the real stdout
    import io
    _real_stdout = sys.stdout
    sys.stdout = sys.stderr  # redirect any accidental prints to stderr
    try:
        emp_id  = int(sys.argv[1]) if len(sys.argv) > 1 else 95516
        extra   = {}
        for arg in sys.argv[2:]:
            if '=' in arg:
                k, v = arg.split('=', 1)
                extra[k.strip()] = v.strip()
        results = run_all_team_leader_metrics(
            emp_id,
            leaderboard_year=extra.get('leaderboard_year'),
            leaderboard_month=extra.get('leaderboard_month'),
        )
        sys.stdout = _real_stdout  # restore before final output
        save_json_to_text(results, "sales_leader_output.txt")
        print(json.dumps(results, indent=4))
    except Exception as e:
        err = {"error": str(e)}
        sys.stdout = _real_stdout  # restore before error output
        save_json_to_text(err, "sales_leader_error_log.txt")
        print(json.dumps(err, indent=4))