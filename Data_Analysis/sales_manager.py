import sys as sys
import os as os

# ── STDOUT GUARD: redirect stdout to stderr for the entire script.
# All library warnings, SQLAlchemy logs, pandas notices go to stderr.
# The ONLY thing that goes to real stdout is our final json.dumps().
real_stdout = sys.stdout
sys.stdout = sys.stderr
os.environ['PYTHONWARNINGS'] = 'ignore'
import warnings as _warnings
_warnings.filterwarnings('ignore')
import logging as _logging
_logging.disable(_logging.CRITICAL)

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
# 2. VALIDATION, UTILITIES
# ==========================================

def sanitize_for_json(obj):
    if isinstance(obj, dict):
        return {k: sanitize_for_json(v) for k, v in obj.items()}
    if isinstance(obj, list):
        return [sanitize_for_json(v) for v in obj]
    if isinstance(obj, float):
        import math
        if math.isnan(obj) or math.isinf(obj):
            return None
    return obj

def save_json_to_text(data, filename="sales_manager_output.txt"):
    try:
        path = os.path.join(os.path.dirname(os.path.abspath(__file__)), filename)
        clean = sanitize_for_json(data)
        with open(path, "w", encoding="utf-8") as f:
            json.dump(clean, f, indent=4)
    except Exception as e:
        print(f"FAILED TO SAVE TEXT FILE: {e}", file=sys.stderr)

def get_user_context(user_id):
    """Validates user_id and fetches role, branch_id, secondary_branch_id."""
    query = f"SELECT role, branch_id, secondary_branch_id, departement_id FROM employee WHERE emp_id = {user_id}"
    df    = pd.read_sql(query, engine)
    if df.empty:
        raise ValueError(f"Access Denied: User ID {user_id} not found.")
    return df.iloc[0].to_dict()

def require_manager(context):
    """Blocks execution if the user is not a Manager."""
    current_role  = str(context.get('role', '')).lower()
    allowed_roles = ['sales_manager', 'dep_manager', 'manager', 'admin', 'hr_manager']
    if current_role not in allowed_roles:
        raise PermissionError(
            f"Access Denied: Your role is '{current_role}'. Manager access required."
        )

def safe_to_dict(df):
    if df.empty:
        return []
    df = df.copy()
    # Handle datetime64 columns
    for col in df.select_dtypes(include=['datetime64']).columns:
        df[col] = df[col].astype(str)
    # Handle object/str columns containing Python date/datetime instances
    for col in df.select_dtypes(include=['object', 'string']).columns:
        df[col] = df[col].apply(
            lambda x: x.isoformat() if isinstance(x, (date, datetime)) else x
        )
    return df.where(pd.notnull(df), None).to_dict(orient='records')

# UPDATED: Enhanced Warning System
def evaluate_warnings(data, metric_key, threshold, condition='less', alert_msg="Alert", format_keys=None):
    warnings = []
    for row in data:
        val = row.get(metric_key)
        if val is None:
            continue
        try:
            if pd.isna(val):
                continue
        except (TypeError, ValueError):
            pass
        try:
            fval = float(val)
        except (TypeError, ValueError):
            continue

        if (condition == 'less' and fval < threshold) or (condition == 'greater' and fval > threshold):
            if format_keys:
                details = " | ".join([
                    f"{k.replace('_', ' ').title()}: {row.get(k, 'N/A')}"
                    for k in format_keys
                ])
                warnings.append(f"WARNING: {alert_msg} ({round(fval, 2)}) -> {details}")
            else:
                warnings.append(f"WARNING: {alert_msg} ({round(fval, 2)})")
    return warnings

# UPDATED: Added hover_data parameter
def generate_chart(df, chart_type, title, x=None, y=None, names=None, values=None, color=None, hover_data=None):
    if df.empty:
        return None
    df_plot = df.copy()
    for col in [x, names]:
        if col and col in df_plot.columns and df_plot[col].dtype in ['int64', 'float64'] and 'id' in col.lower():
            df_plot[col] = df_plot[col].astype(str)
    try:
        if   chart_type == 'bar':  fig = px.bar(df_plot,  x=x,     y=y,     color=color, title=title, hover_data=hover_data)
        elif chart_type == 'pie':  fig = px.pie(df_plot,  names=names, values=values, color=color, title=title, hover_data=hover_data)
        elif chart_type == 'line': fig = px.line(df_plot, x=x,     y=y,     color=color, title=title, hover_data=hover_data)
        else: return None
        return json.loads(fig.to_json())
    except Exception:
        return None

# ==========================================
# 3. GLOBAL SALES MANAGER METRICS
# ==========================================

# GLOBAL FILTERS
GLOBAL_START  = '2025-01-01'
GLOBAL_END    = '2026-12-31'
GLOBAL_PERIOD = "Jan 2025 - Apr 2026"
DATE_FILTER   = f"transaction_date >= '{GLOBAL_START}' AND transaction_date <= '{GLOBAL_END}'"
ESL_FILTER    = f"esl.transaction_date >= '{GLOBAL_START}' AND esl.transaction_date <= '{GLOBAL_END}'"

def get_global_total_revenue(uid):
    require_manager(get_user_context(uid))
    query = f"SELECT SUM(price) as total_company_revenue FROM employee_sales_log WHERE {DATE_FILTER}"
    df = pd.read_sql(query, engine)
    return {"data": safe_to_dict(df.round(2)), "warnings": [], "chart": None, "period": GLOBAL_PERIOD}

def get_global_monthly_revenue(uid, year=None, month=None):
    require_manager(get_user_context(uid))
    today = date.today()
    yr = year  if year  else today.year
    mo = month if month else today.month
    df = pd.read_sql(
        f"""SELECT SUM(price) as monthly_revenue, COUNT(record_id) as monthly_transactions
           FROM employee_sales_log
           WHERE YEAR(transaction_date) = {yr} AND MONTH(transaction_date) = {mo}
             AND {DATE_FILTER}""",
        engine
    )
    month_label = f"{calendar.month_name[mo]} {yr} (Within {GLOBAL_PERIOD})"
    return {"data": safe_to_dict(df.round(2)), "warnings": [], "chart": None, "period": month_label}

def get_global_sales_volume(uid):
    require_manager(get_user_context(uid))
    query = f"SELECT SUM(amount) as total_units_sold FROM employee_sales_log WHERE {DATE_FILTER}"
    df = pd.read_sql(query, engine)
    return {"data": safe_to_dict(df), "warnings": [], "chart": None, "period": GLOBAL_PERIOD} 


def get_global_avg_inventory_turnover(uid, year=None, month=None):
    require_manager(get_user_context(uid))
    today = date.today()
    yr = int(year) if year else None
    mo = int(month) if month else None

    # Build a scoped date filter for the chosen month/year or fall back to global range
    if yr and mo:
        period_label = f"{calendar.month_name[mo]} {yr}"
        date_clause = f"esl.transaction_date >= '{yr}-{mo:02d}-01' AND esl.transaction_date < DATE_ADD('{yr}-{mo:02d}-01', INTERVAL 1 MONTH)"
    elif yr:
        period_label = f"Year {yr}"
        date_clause = f"YEAR(esl.transaction_date) = {yr}"
    else:
        period_label = GLOBAL_PERIOD
        date_clause = ESL_FILTER

    query = f"""
        SELECT p.product_id, p.name, p.type, p.model,
               p.amount_avail AS ending_inventory,
               COALESCE(SUM(esl.amount), 0) AS total_units_sold,
               ROUND(COALESCE(SUM(esl.amount), 0) * p.price_before_profit, 2) AS cogs,
               (p.amount_avail + COALESCE(SUM(esl.amount), 0)) AS beginning_inventory,
               ROUND(((p.amount_avail + COALESCE(SUM(esl.amount), 0)) + p.amount_avail)
                     / 2.0 * p.price_before_profit, 2) AS average_inventory,
               CASE
                   WHEN ((p.amount_avail + COALESCE(SUM(esl.amount), 0)) + p.amount_avail) / 2.0 > 0
                   THEN ROUND(
                       COALESCE(SUM(esl.amount), 0) /
                       NULLIF(((p.amount_avail + COALESCE(SUM(esl.amount), 0)) + p.amount_avail) / 2.0, 0),
                   2)
                   ELSE 0
               END AS turnover_rate
        FROM product p
        LEFT JOIN product_sold_log psl ON p.product_id = psl.product_id
        LEFT JOIN employee_sales_log esl ON psl.record_id = esl.record_id AND {date_clause}
        GROUP BY p.product_id, p.name, p.type, p.model, p.amount_avail, p.price_before_profit
        ORDER BY turnover_rate ASC
    """
    df = pd.read_sql(query, engine)
    df['days_to_sell'] = df['turnover_rate'].apply(lambda x: round(365 / x, 2) if pd.notnull(x) and x > 0 else None)
    data = safe_to_dict(df.round(2))
    warnings = evaluate_warnings(data, 'turnover_rate', 1.0, 'less', "Low Turnover — Possible Dead Stock", format_keys=['product_id', 'name'])
    chart = generate_chart(df, 'bar', f'Inventory Turnover Rate ({period_label})', x='type', y='turnover_rate', color='name', hover_data=['model'])
    return {"data": data, "warnings": warnings, "chart": chart, "period": period_label}

def get_global_branch_performance(uid):
    require_manager(get_user_context(uid))
    query = f"""
        SELECT esl.branch_id, b.location AS branch_name,
               SUM(esl.price) as branch_revenue, SUM(esl.amount) as branch_volume,
               COUNT(esl.record_id) as total_transactions
        FROM employee_sales_log esl
        LEFT JOIN branch b ON esl.branch_id = b.b_id
        WHERE {DATE_FILTER}
        GROUP BY esl.branch_id, b.location ORDER BY branch_revenue DESC
    """
    df    = pd.read_sql(query, engine)
    chart = generate_chart(df, 'bar', f'Branch Performance ({GLOBAL_PERIOD})', x='branch_name', y='branch_revenue')
    return {"data": safe_to_dict(df.round(2)), "warnings": [], "chart": chart, "period": GLOBAL_PERIOD}

def get_global_branch_performance_by_month(uid, year=None, month=None):
    require_manager(get_user_context(uid))
    today = date.today()
    yr = year  if year  else today.year
    mo = month if month else today.month
    query = f"""
        SELECT esl.branch_id, b.location AS branch_name,
               SUM(esl.price) as branch_revenue, SUM(esl.amount) as branch_volume,
               COUNT(esl.record_id) as total_transactions
        FROM employee_sales_log esl
        LEFT JOIN branch b ON esl.branch_id = b.b_id
        WHERE YEAR(esl.transaction_date) = {yr} AND MONTH(esl.transaction_date) = {mo} AND {DATE_FILTER}
        GROUP BY esl.branch_id, b.location ORDER BY branch_revenue DESC
    """
    df          = pd.read_sql(query, engine)
    month_label = f"{calendar.month_name[mo]} {yr}"
    chart       = generate_chart(df, 'bar', f'Branch Performance — {month_label}', x='branch_name', y='branch_revenue')
    return {"data": safe_to_dict(df.round(2)), "warnings": [], "chart": chart, "period": month_label}

def get_global_top_sales_reps(uid):
    require_manager(get_user_context(uid))
    query = f"""
        SELECT e.emp_id, e.First_Name, e.Last_Name, e.branch_id, b.location AS branch_name,
               SUM(esl.price) as total_sales_revenue, COUNT(esl.record_id) as deals_closed
        FROM employee_sales_log esl
        JOIN employee e ON esl.employee_id = e.emp_id
        LEFT JOIN branch b ON e.branch_id = b.b_id
        WHERE e.role != 'dep_manager' AND {ESL_FILTER}
        GROUP BY e.emp_id, e.First_Name, e.Last_Name, e.branch_id, b.location
        ORDER BY total_sales_revenue DESC LIMIT 10
    """
    df = pd.read_sql(query, engine)
    # Leaderboard rule: ranking people → no chart, signal leaderboard UI
    return {"data": safe_to_dict(df.round(2)), "warnings": [], "chart": None, "chart_type": "leaderboard", "period": GLOBAL_PERIOD}

def get_global_top_sales_reps_this_month(uid):
    require_manager(get_user_context(uid))
    query = f"""
        SELECT e.emp_id, e.First_Name, e.Last_Name, e.branch_id, b.location AS branch_name,
               COALESCE(SUM(esl.price), 0) as total_sales_revenue, COUNT(esl.record_id) as deals_closed
        FROM employee e
        LEFT JOIN branch b ON e.branch_id = b.b_id
        LEFT JOIN employee_sales_log esl ON esl.employee_id = e.emp_id
            AND YEAR(esl.transaction_date) = YEAR(CURDATE()) AND MONTH(esl.transaction_date) = MONTH(CURDATE())
            AND {ESL_FILTER}
        WHERE e.departement_id = 1 AND e.role != 'dep_manager'
        GROUP BY e.emp_id, e.First_Name, e.Last_Name, e.branch_id, b.location
        ORDER BY total_sales_revenue DESC LIMIT 10
    """
    df = pd.read_sql(query, engine)
    # Leaderboard rule: ranking people → no chart, signal leaderboard UI
    return {"data": safe_to_dict(df.round(2)), "warnings": [], "chart": None, "chart_type": "leaderboard", "period": "This Month"}


def get_global_top_selling_products(uid):
    require_manager(get_user_context(uid))
    query = f"""
        SELECT p.product_id, p.name, p.model, SUM(esl.price) as total_revenue, SUM(esl.amount) as total_units_sold ,p.price_after_profit as unit_price
        FROM employee_sales_log esl
        JOIN product_sold_log psl ON esl.record_id  = psl.record_id
        JOIN product p            ON psl.product_id = p.product_id
        WHERE {ESL_FILTER}
        GROUP BY p.product_id, p.name, p.model
        ORDER BY total_revenue DESC LIMIT 10
    """
    df    = pd.read_sql(query, engine)
    # UPDATED: Added hover_data=['model']
    chart = generate_chart(df, 'bar', f'Global Top Products ({GLOBAL_PERIOD})', x='name', y='total_revenue', hover_data=['model'])
    return {"data": safe_to_dict(df.round(2)), "warnings": [], "chart": chart, "period": GLOBAL_PERIOD}

def get_global_sales_by_category(uid):
    require_manager(get_user_context(uid))
    query = f"""
        SELECT p.type, SUM(esl.price) as category_revenue, SUM(esl.amount) as category_volume
        FROM employee_sales_log esl
        JOIN product_sold_log psl ON esl.record_id  = psl.record_id
        JOIN product p            ON psl.product_id = p.product_id
        WHERE {ESL_FILTER}
        GROUP BY p.type ORDER BY category_revenue DESC
    """
    df    = pd.read_sql(query, engine)
    chart = generate_chart(df, 'pie', f'Sales by Category ({GLOBAL_PERIOD})', names='type', values='category_revenue')
    return {"data": safe_to_dict(df.round(2)), "warnings": [], "chart": chart, "period": GLOBAL_PERIOD}

def get_global_product_profit_margins(uid):
    """All products ranked by unit profit margin. (No date filter needed as this relies on static catalog pricing)"""
    require_manager(get_user_context(uid))
    query = "SELECT product_id, name, type, model, (price_after_profit - price_before_profit) as unit_profit_margin FROM product ORDER BY unit_profit_margin DESC"
    df    = pd.read_sql(query, engine)
    # UPDATED: Added hover_data=['model']
    chart = generate_chart(df, 'bar', 'All Products — Profit Margin', x='name', y='unit_profit_margin', hover_data=['model'])
    return {"data": safe_to_dict(df.round(2)), "warnings": [], "chart": chart, "period": "Current Catalog"}

def get_global_low_inventory_alerts(uid):
    """Products with stock <= 15 units. (No date filter needed as this looks at current static stock)"""
    require_manager(get_user_context(uid))
    query = "SELECT product_id, name, model, amount_avail FROM product WHERE amount_avail <= 15 ORDER BY amount_avail ASC"
    df = pd.read_sql(query, engine)
    data = safe_to_dict(df)
    warnings = evaluate_warnings(data, 'amount_avail', 16, 'less', "Low Inventory — Action Required", format_keys=['product_id', 'name'])
    # UPDATED: Added hover_data=['model']
    return {"data": data, "warnings": warnings, "chart": generate_chart(df, 'bar', 'Low Inventory', x='name', y='amount_avail', hover_data=['model']), "period": "Current Stock"}

def get_global_low_sales_branch_alert(uid):
    require_manager(get_user_context(uid))
    today = date.today()
    query = f"""
        SELECT esl.branch_id, b.location AS branch_name,
               COUNT(esl.record_id) as monthly_transactions,
               COALESCE(SUM(esl.price), 0) as monthly_revenue
        FROM employee_sales_log esl
        LEFT JOIN branch b ON esl.branch_id = b.b_id
        WHERE YEAR(esl.transaction_date) = {today.year} AND MONTH(esl.transaction_date) = {today.month} AND {DATE_FILTER}
        GROUP BY esl.branch_id, b.location ORDER BY monthly_transactions ASC
    """
    df       = pd.read_sql(query, engine)
    data     = safe_to_dict(df)
    warnings = evaluate_warnings(data, 'monthly_transactions', 20, 'less', "Branch Below 20 Monthly Transactions", format_keys=['branch_id', 'branch_name'])
    chart    = generate_chart(df, 'bar', 'Monthly Transactions per Branch', x='branch_name', y='monthly_transactions')
    return {"data": data, "warnings": warnings, "chart": chart, "period": f"{calendar.month_name[today.month]} {today.year}"}




def get_global_low_sales_rep_alert(uid, year=None, month=None):
    require_manager(get_user_context(uid))
    today = date.today()
    yr = year  if year  else today.year
    mo = month if month else today.month
    query = f"""
        SELECT e.emp_id, e.First_Name, e.Last_Name, e.branch_id, COUNT(esl.record_id) as deals_closed
        FROM employee e
        LEFT JOIN employee_sales_log esl ON esl.employee_id = e.emp_id
            AND YEAR(esl.transaction_date) = {yr} AND MONTH(esl.transaction_date) = {mo}
            AND {ESL_FILTER}
        WHERE e.departement_id = 1 AND e.role != 'dep_manager'
        GROUP BY e.emp_id, e.First_Name, e.Last_Name, e.branch_id
        ORDER BY deals_closed ASC
    """
    df          = pd.read_sql(query, engine)
    data        = safe_to_dict(df)
    warnings    = evaluate_warnings(data, 'deals_closed', 5, 'less', "Sales Rep Below 5 Deals This Month", format_keys=['emp_id', 'First_Name'])
    month_label = f"{calendar.month_name[mo]} {yr}"
    # Leaderboard rule: ranking people (bottom) → signal leaderboard UI
    return {"data": data, "warnings": warnings, "chart": None, "chart_type": "leaderboard", "period": month_label}

def get_global_recent_transactions(uid):
    require_manager(get_user_context(uid))
    query = f"""
        SELECT esl.record_id, esl.branch_id, esl.transaction_date, esl.amount, esl.price, p.name as product_name
        FROM employee_sales_log esl
        JOIN product_sold_log psl ON esl.record_id  = psl.record_id
        JOIN product p            ON psl.product_id = p.product_id
        WHERE {ESL_FILTER}
        ORDER BY esl.transaction_date DESC LIMIT 15
    """
    df = pd.read_sql(query, engine)
    return {"data": safe_to_dict(df), "warnings": [], "chart": None, "period": f"Latest 15 in {GLOBAL_PERIOD}"}

def get_global_avg_order_value(uid):
    require_manager(get_user_context(uid))
    df = pd.read_sql(f"SELECT AVG(price) as global_avg_order_value FROM employee_sales_log WHERE {DATE_FILTER}", engine)
    return {"data": safe_to_dict(df.round(2)), "warnings": [], "chart": None, "period": GLOBAL_PERIOD}

def get_global_sales_trends(uid):
    require_manager(get_user_context(uid))
    query = f"""
        SELECT CONCAT(YEAR(transaction_date), '-', LPAD(MONTH(transaction_date), 2, '0')) as month, SUM(price) as revenue
        FROM employee_sales_log
        WHERE {DATE_FILTER}
        GROUP BY month ORDER BY month ASC
    """
    df    = pd.read_sql(query, engine)
    chart = generate_chart(df, 'line', f'Revenue Trend ({GLOBAL_PERIOD})', x='month', y='revenue')
    return {"data": safe_to_dict(df.round(2)), "warnings": [], "chart": chart, "period": GLOBAL_PERIOD}

def get_global_quarterly_sales_forecast(uid):
    require_manager(get_user_context(uid))
    query = f"""
        SELECT YEAR(transaction_date) as yr, QUARTER(transaction_date) as qtr, SUM(price) as volume
        FROM employee_sales_log
        WHERE {DATE_FILTER}
        GROUP BY yr, qtr ORDER BY yr, qtr
    """
    df = pd.read_sql(query, engine)

    if df.empty:
        return {"data": [], "warnings": [], "chart": None, "period": "Current Quarter"}

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
        curr_vol  = df.loc[curr_mask, 'volume'].values[0]
        proj_vol  = float(curr_vol * multiplier)
        past_vols = df.loc[~curr_mask, 'volume']
        if not past_vols.empty:
            avg_past = past_vols.mean()
            if proj_vol < avg_past * 0.85:
                warnings.append(
                    f"WARNING: Projected global revenue ({proj_vol:,.2f} EGP) for Q{curr_qtr} "
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

    chart = generate_chart(df, 'bar', f'Quarterly Sales Forecast ({GLOBAL_PERIOD})', x='period', y='volume', color='type')
    return {"data": safe_to_dict(df.round(2)), "warnings": warnings, "chart": chart, "period": "Quarterly Forecast"}

def get_global_profit_loss_analysis(uid):
    require_manager(get_user_context(uid))

    query_loss = f"""
        SELECT p.product_id, p.name, p.type, p.model,
               SUM(esl.amount)                              AS total_units_sold,
               ROUND(SUM(esl.price), 2)                    AS total_revenue,
               ROUND(SUM(esl.amount * p.price_before_profit), 2) AS total_cogs,
               ROUND(SUM(esl.price) - SUM(esl.amount * p.price_before_profit), 2) AS net_profit
        FROM employee_sales_log esl
        JOIN product_sold_log psl ON esl.record_id  = psl.record_id
        JOIN product p            ON psl.product_id = p.product_id
        WHERE {ESL_FILTER}
        GROUP BY p.product_id, p.name, p.type, p.model
        HAVING net_profit < 0
        ORDER BY net_profit ASC
    """
    df_loss = pd.read_sql(query_loss, engine)

    query_dead = f"""
        SELECT p.product_id, p.name, p.type, p.model,
               p.amount_avail,
               p.price_before_profit,
               ROUND(p.amount_avail * p.price_before_profit, 2) AS tied_capital
        FROM product p
        WHERE p.amount_avail > 0 AND p.product_id NOT IN (
            SELECT psl_inner.product_id
            FROM product_sold_log psl_inner
            JOIN employee_sales_log esl_inner ON psl_inner.record_id = esl_inner.record_id
            WHERE esl_inner.transaction_date >= '{GLOBAL_START}' AND esl_inner.transaction_date <= '{GLOBAL_END}'
        )
        ORDER BY tied_capital DESC
    """
    df_dead = pd.read_sql(query_dead, engine)

    query_gap = f"""
        SELECT
            ROUND(SUM(esl.price), 2)                           AS total_revenue,
            ROUND(SUM(esl.amount * p.price_before_profit), 2)  AS total_cogs,
            ROUND(SUM(esl.price) - SUM(esl.amount * p.price_before_profit), 2) AS total_net_profit
        FROM employee_sales_log esl
        JOIN product_sold_log psl ON esl.record_id = psl.record_id
        JOIN product p            ON psl.product_id = p.product_id
        WHERE {ESL_FILTER}
    """
    df_gap = pd.read_sql(query_gap, engine)

    warnings = evaluate_warnings(
        safe_to_dict(df_loss), 'net_profit', 0, 'less',
        f"CRITICAL LEAK: Product Sold at a Loss ({GLOBAL_PERIOD})",
        format_keys=['product_id', 'name']
    )
    for _, row in df_dead.iterrows():
        warnings.append(
            f"WARNING: Dead Stock Capital Drain (No sales {GLOBAL_PERIOD}) -> "
            f"Product ID: {row['product_id']} | Name: {row['name']} | "
            f"Units: {row['amount_avail']} | Capital Tied: {row['tied_capital']:,.2f} EGP"
        )

    # UPDATED: Added hover_data=['model']
    chart = generate_chart(df_loss, 'bar', f'Loss-Making Products ({GLOBAL_PERIOD})', x='name', y='net_profit', hover_data=['model'])

    return {
        "loss_products":  safe_to_dict(df_loss.round(2)),
        "dead_stock":     safe_to_dict(df_dead.round(2)),
        "summary":        safe_to_dict(df_gap.round(2)),
        "data":           safe_to_dict(df_loss.round(2)),
        "warnings":       warnings,
        "chart":          chart,
        "period":         GLOBAL_PERIOD
    }

# ==========================================
# 4. EXECUTION WRAPPER
# ==========================================

def run_all_sales_manager_metrics(user_id, monthly_revenue_year=None, monthly_revenue_month=None,
                                   branch_perf_year=None, branch_perf_month=None,
                                   turnover_year=None, turnover_month=None):
    results = {}

    plain_funcs = [
        get_global_total_revenue,
        get_global_sales_volume,
        get_global_branch_performance,
        get_global_top_sales_reps,
        get_global_top_sales_reps_this_month,
        get_global_top_selling_products,
        get_global_sales_by_category,
        get_global_product_profit_margins,
        get_global_low_inventory_alerts,
        get_global_low_sales_branch_alert,
        get_global_low_sales_rep_alert,
        get_global_recent_transactions,
        get_global_avg_order_value,
        get_global_sales_trends,
        get_global_quarterly_sales_forecast,
        get_global_profit_loss_analysis
    ]
    for func in plain_funcs:
        try:
            results[func.__name__] = func(user_id)
        except Exception as e:
            results[func.__name__] = {"data": [], "warnings": [f"Error: {str(e)}"],
                                      "chart": None, "period": "N/A"}

    try:
        results['get_global_monthly_revenue'] = get_global_monthly_revenue(
            user_id,
            year=int(monthly_revenue_year) if monthly_revenue_year else None,
            month=int(monthly_revenue_month) if monthly_revenue_month else None,
        )
    except Exception as e:
        results['get_global_monthly_revenue'] = {"data": [], "warnings": [f"Error: {str(e)}"], "chart": None, "period": "N/A"}

    try:
        results['get_global_branch_performance_by_month'] = get_global_branch_performance_by_month(
            user_id,
            year=int(branch_perf_year) if branch_perf_year else None,
            month=int(branch_perf_month) if branch_perf_month else None,
        )
    except Exception as e:
        results['get_global_branch_performance_by_month'] = {"data": [], "warnings": [f"Error: {str(e)}"], "chart": None, "period": "N/A"}

    try:
        results['get_global_avg_inventory_turnover'] = get_global_avg_inventory_turnover(
            user_id,
            year=int(turnover_year) if turnover_year else None,
            month=int(turnover_month) if turnover_month else None,
        )
    except Exception as e:
        results['get_global_avg_inventory_turnover'] = {"data": [], "warnings": [f"Error: {str(e)}"], "chart": None, "period": "N/A"}

    return results

# ==========================================
# 5. NODE.JS EXECUTION BRIDGE
# ==========================================
if __name__ == "__main__":
    try:
        emp_id = int(sys.argv[1]) if len(sys.argv) > 1 else 79397

        extra = {}
        for arg in sys.argv[2:]:
            if '=' in arg:
                k, v = arg.split('=', 1)
                extra[k.strip()] = v.strip()

        results = run_all_sales_manager_metrics(
            emp_id,
            monthly_revenue_year=extra.get('monthly_revenue_year'),
            monthly_revenue_month=extra.get('monthly_revenue_month'),
            branch_perf_year=extra.get('branch_perf_year'),
            branch_perf_month=extra.get('branch_perf_month'),
            turnover_year=extra.get('turnover_year'),
            turnover_month=extra.get('turnover_month'),
        )
        sys.stdout = real_stdout
        clean_results = sanitize_for_json(results)
        save_json_to_text(clean_results, "sales_manager_output.txt")
        print(json.dumps(clean_results, indent=4))
    except Exception as e:
        err = {"error": str(e)}
        sys.stdout = real_stdout
        save_json_to_text(err, "sales_manager_error_log.txt")
        print(json.dumps(err, indent=4))