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
# 2. VALIDATION, UTILITIES & HR SCOPE
# ==========================================

def save_json_to_text(data, filename="hr_employee_output.txt"):
    """Saves the JSON results to a text file in the exact same folder as this script."""
    try:
        # 1. Get the directory where this Python file currently lives
        current_dir = os.path.dirname(os.path.abspath(__file__))
        
        # 2. Create an absolute path for the text file
        file_path = os.path.join(current_dir, filename)
        
        # 3. Write the file
        with open(file_path, "w", encoding="utf-8") as f:
            json.dump(data, f, indent=4)
            
    except Exception as e:
        # Print the error to standard error so Node.js will actually show it to you in the console!
        print(f"FAILED TO SAVE TEXT FILE: {e}", file=sys.stderr)

def get_user_context(user_id):
    query = f"SELECT role, branch_id, secondary_branch_id, departement_id FROM employee WHERE emp_id = {user_id}"
    df = pd.read_sql(query, engine)
    if df.empty:
        raise ValueError(f"Access Denied: User ID {user_id} not found.")
    return df.iloc[0].to_dict()

def get_hr_scope_filter(context, emp_table_alias='e'):
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
    return f" AND {emp_table_alias}.branch_id IN ({branches_str}) "

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
    """Generates a Plotly chart and safely converts it to a JSON dictionary."""
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
# 3. BRANCH HR METRICS
#====================================================================================

def get_branch_headcount(uid):
    ctx = get_user_context(uid)
    f = get_hr_scope_filter(ctx, 'e')
    
    query = f"""
        SELECT e.branch_id, b.location as Name, COUNT(e.emp_id) as branch_headcount 
        FROM employee e 
        JOIN branch b ON e.branch_id = b.b_id
        WHERE 1=1 {f} 
        GROUP BY e.branch_id, b.location
    """
    df = pd.read_sql(query, engine)
    
    # Using 'location' for the chart x-axis
    chart = generate_chart(df, 'bar', 'Branch Headcount', x='Name', y='branch_headcount')
    return {"data": safe_to_dict(df), "warnings": [], "chart": chart}

def get_branch_payroll(uid):
    ctx = get_user_context(uid)
    f = get_hr_scope_filter(ctx, 'e')
    
    # 1. Added JOIN branch b ON e.branch_id = b.b_id
    # 2. Added b.location to the SELECT and GROUP BY clauses
    query = f"""
        SELECT 
            e.branch_id, 
            b.location as Name,
            SUM(e.salary) as branch_payroll 
        FROM employee e 
        JOIN branch b ON e.branch_id = b.b_id
        WHERE 1=1 {f} 
        GROUP BY e.branch_id, b.location
    """
    
    df = pd.read_sql(query, engine)
    data = safe_to_dict(df.round(2))
    
    warnings = evaluate_warnings(data, 'branch_payroll', 200000, 'greater', "Branch payroll exceeding local budget")
    
    # 3. Updated x-axis to 'location' so the chart shows names instead of IDs
    chart = generate_chart(df, 'bar', 'Payroll Distribution by Branch', x='Name', y='branch_payroll')
    
    return {"data": data, "warnings": warnings, "chart": chart}


def get_branch_avg_salary(uid):
    ctx = get_user_context(uid)
    f = get_hr_scope_filter(ctx, 'e')

    # Combined average across both branches the HR employee is responsible for
    query = f"""
        SELECT AVG(e.salary) as avg_salary
        FROM employee e
        WHERE 1=1 {f}
    """

    df = pd.read_sql(query, engine)
    avg_val = round(float(df['avg_salary'].iloc[0]), 2) if not df.empty and df['avg_salary'].iloc[0] is not None else 0

    return {
        "data": [{"avg_salary": avg_val}],
        "warnings": [],
        "chart": None,
        "combined_avg_salary": avg_val
    }

def get_branch_avg_tenure(uid):
    ctx = get_user_context(uid)
    f = get_hr_scope_filter(ctx, 'e')
    
    query = f"""
        SELECT e.branch_id, b.location as Name, AVG(TIMESTAMPDIFF(YEAR, e.hired, CURDATE())) as avg_tenure 
        FROM employee e 
        JOIN branch b ON e.branch_id = b.b_id
        WHERE 1=1 {f} 
        GROUP BY e.branch_id, b.location
    """
    df = pd.read_sql(query, engine)
    
    # Using 'location' for the chart x-axis
    chart = generate_chart(df, 'bar', 'Average Tenure per Branch (Years)', x='Name', y='avg_tenure')
    return {"data": safe_to_dict(df.round(1)), "warnings": [], "chart": chart}

def get_branch_gender_distribution(uid):
    ctx = get_user_context(uid)
    f = get_hr_scope_filter(ctx, 'e')
    
    # We keep location in the SELECT so it shows in the 'details' table
    # But we make sure gender is prominent for the chart/summary
    query = f"""
        SELECT 
            e.gender, 
            b.location as Name,
            COUNT(e.emp_id) as count 
        FROM employee e 
        JOIN branch b ON e.branch_id = b.b_id
        WHERE 1=1 {f} 
        GROUP BY e.gender, b.location
    """
    df = pd.read_sql(query, engine)
    
    # CRITICAL: For the chart/summary header, we group strictly by gender 
    # so the AI/Frontend sees 'Male' or 'Female' as the primary category.
    summary_df = df.groupby('gender')['count'].sum().reset_index()
    
    chart = generate_chart(summary_df, 'pie', 'Gender Distribution', names='gender', values='count')
    
    return {
        "data": safe_to_dict(df), # Detailed table still shows locations
        "warnings": [], 
        "chart": chart
    }


def get_branch_flight_risk(uid):
    ctx = get_user_context(uid)
    f = get_hr_scope_filter(ctx, 'e')
    query = f"""
        SELECT e.branch_id, e.emp_id, e.first_name, e.last_name 
        FROM employee e 
        WHERE e.salary < (SELECT AVG(salary) FROM employee) AND TIMESTAMPDIFF(YEAR, e.hired, CURDATE()) >= 3 {f}
    """
    df = pd.read_sql(query, engine)
    return {"data": safe_to_dict(df), "warnings": [], "chart": None}

def get_branch_burnout_risk(uid):
    ctx = get_user_context(uid)
    f = get_hr_scope_filter(ctx, 'e')
    query = f"SELECT e.branch_id, e.emp_id, e.first_name, b.total_annual_left FROM employee e JOIN adherence_balance b ON e.emp_id = b.employee_id WHERE b.total_annual_left < 3 {f}"
    df = pd.read_sql(query, engine)
    return {"data": safe_to_dict(df), "warnings": [], "chart": None}

def get_branch_high_absenteeism(uid):
    ctx = get_user_context(user_id=uid)
    f = get_hr_scope_filter(ctx, 'e')
    
    # 1. Added JOIN to branch table for the location
    # 2. Added CONCAT for the employee's full name
    # 3. Filtered for the CURRENT MONTH
    query = f"""
        SELECT 
            e.branch_id, 
            b.location AS branch_name,
            l.emp_id, 
            CONCAT(e.first_name, ' ', e.last_name) AS employee_name,
            COUNT(l.leave_date) as abs_count 
        FROM adherence_log l 
        JOIN employee e ON l.emp_id = e.emp_id 
        JOIN branch b ON e.branch_id = b.b_id
        WHERE l.leave_type IS NOT NULL 
          AND l.leave_type != 'off' 
          AND YEAR(l.leave_date) = YEAR(CURDATE())
          AND MONTH(l.leave_date) = MONTH(CURDATE()) {f} 
        GROUP BY e.branch_id, b.location, l.emp_id, employee_name 
        HAVING abs_count > 4
        ORDER BY abs_count DESC
    """
    
    df = pd.read_sql(query, engine)
    data = safe_to_dict(df)
    
    # Create a clean summary warning for the top of the modal
    warnings = []
    if len(data) > 0:
        warnings.append(f"WARNING: {len(data)} employees have exceeded 4 absences this month.")
        
    # Optional: Generate a leaderboard chart to visualize the highest absenteeism
    chart = None
    if not df.empty:
        chart = generate_chart(df, 'leaderboard', 'High Absenteeism (Current Month)', x='employee_name', y='abs_count')
    
    return {
        "data": data, 
        "warnings": warnings, 
        "chart": chart
    }

def get_branch_avg_sick_days(uid):
    ctx = get_user_context(uid)
    f = get_hr_scope_filter(ctx, 'e')
    
    # 1. Added JOIN to branch br
    # 2. Selected br.location as Name and added to GROUP BY
    query = f"""
        SELECT 
            e.branch_id, 
            br.location AS Name,
            AVG(b.sick_days) as branch_sick 
        FROM adherence_balance b 
        JOIN employee e ON b.employee_id = e.emp_id 
        JOIN branch br ON e.branch_id = br.b_id
        WHERE 1=1 {f} 
        GROUP BY e.branch_id, br.location
    """
    
    df = pd.read_sql(query, engine)
    
    # 3. Updated x-axis to use 'Name' so the chart displays the location text
    chart = generate_chart(df, 'bar', 'Avg Sick Days Taken', x='Name', y='branch_sick')
    
    return {"data": safe_to_dict(df.round(1)), "warnings": [], "chart": chart}

def get_branch_total_expenses(uid):
    ctx = get_user_context(uid)
    f = get_hr_scope_filter(ctx, 'e')
    
    # 1. Added JOIN to branch b
    # 2. Selected b.location as Name and included it in the GROUP BY
    query = f"""
        SELECT 
            e.branch_id, 
            b.location as Name,
            SUM(ex.amount) as branch_expenses 
        FROM employee_expenses_record ex 
        JOIN employee e ON ex.employee_id = e.emp_id 
        JOIN branch b ON e.branch_id = b.b_id
        WHERE 1=1 {f} 
        GROUP BY e.branch_id, b.location
    """
    
    df = pd.read_sql(query, engine)
    
    # 3. Changed x-axis to 'Name' so the chart displays the readable location
    chart = generate_chart(df, 'bar', 'Total Expenses', x='Name', y='branch_expenses')
    
    return {"data": safe_to_dict(df.round(2)), "warnings": [], "chart": chart}


#this function must be leadreboard not bar chart
def get_branch_top_expense_claimers(uid):
    ctx = get_user_context(uid)
    f = get_hr_scope_filter(ctx, 'e')
    
    # 1. Added JOIN to branch b to grab b.location
    # 2. Used CONCAT to merge first_name and last_name
    query = f"""
        SELECT 
            e.branch_id, 
            b.location AS branch_name,
            e.emp_id, 
            CONCAT(e.first_name, ' ', e.last_name) AS employee_name, 
            SUM(ex.amount) as claimed 
        FROM employee_expenses_record ex 
        JOIN employee e ON ex.employee_id = e.emp_id 
        JOIN branch b ON e.branch_id = b.b_id
        WHERE 1=1 {f} 
        GROUP BY e.branch_id, b.location, e.emp_id, employee_name
        ORDER BY claimed DESC 
        LIMIT 5
    """
    
    df = pd.read_sql(query, engine)
    
    # Updated to leaderboard chart type
    chart = generate_chart(df, 'leaderboard', 'Top Expense Claimers', x='employee_name', y='claimed')
    
    return {
        "data": safe_to_dict(df.round(2)), 
        "warnings": [], 
        "chart": chart
    }


def get_branch_ticket_volume(uid):
    ctx = get_user_context(uid)
    f = get_hr_scope_filter(ctx, 'e')
    
    # 1. Added JOIN to branch b
    # 2. Selected b.location as Name and added to GROUP BY
    query = f"""
        SELECT 
            e.branch_id, 
            b.location AS Name,
            t.type, 
            COUNT(t.ticket_id) as volume 
        FROM ticket t 
        JOIN employee e ON t.employee_id = e.emp_id 
        JOIN branch b ON e.branch_id = b.b_id
        WHERE t.time >= DATE_SUB(CURDATE(), INTERVAL 16 MONTH) {f} 
        GROUP BY e.branch_id, b.location, t.type
    """
    
    df = pd.read_sql(query, engine)
    
    # 3. CRITICAL: Group by 'type' for the pie chart and header summary 
    # so the UI doesn't confuse the branch 'Name' with the ticket 'type'.
    summary_df = pd.DataFrame()
    if not df.empty:
        summary_df = df.groupby('type')['volume'].sum().reset_index()
        
    chart = generate_chart(summary_df, 'pie', 'Ticket Volume by Type', names='type', values='volume')
    
    return {
        "data": safe_to_dict(df), # Detailed table keeps the location data
        "warnings": [], 
        "chart": chart
    }
    

def get_branch_unresolved_tickets(uid):
    ctx = get_user_context(uid)
    f = get_hr_scope_filter(ctx, 'e')
    
    # 1. CAST(t.ticket_id AS CHAR) prevents the UI from summing the IDs
    # 2. Added '1 AS ticket_count' to give the UI a real metric to sum (resulting in the row count)
    query = f"""
        SELECT 
            CAST(t.ticket_id AS CHAR) AS ticket_id, 
            t.time, 
            t.type, 
            CONCAT(e.first_name, ' ', e.last_name) AS employee_name, 
            b.location AS branch_name,
            1 AS ticket_count
        FROM ticket t 
        JOIN employee e ON t.employee_id = e.emp_id 
        JOIN branch b ON e.branch_id = b.b_id
        WHERE YEAR(t.time) = YEAR(CURDATE()) 
          AND MONTH(t.time) = MONTH(CURDATE()) {f} 
        ORDER BY t.time ASC 
        LIMIT 10
    """
    
    df = pd.read_sql(query, engine)
    data = safe_to_dict(df)
    
    warnings = []
    if len(data) > 100:
        warnings.append(f"ATTENTION: There are {len(data)} unresolved tickets pending from this month.")
        
    # 3. Added a chart grouped by ticket_count to ensure the big header displays the count
    chart = None
    if not df.empty:
        summary_df = df.groupby('type')['ticket_count'].sum().reset_index()
        chart = generate_chart(summary_df, 'pie', 'Unresolved Tickets by Type', names='type', values='ticket_count')
        
    return {
        "data": data, 
        "warnings": warnings, 
        "chart": chart
    }

def get_branch_avg_age(uid):
    ctx = get_user_context(uid)
    f = get_hr_scope_filter(ctx, 'e')
    
    # 1. Added JOIN to branch b
    # 2. Selected b.location as Name and added to GROUP BY
    query = f"""
        SELECT 
            e.branch_id, 
            b.location AS Name,
            AVG(TIMESTAMPDIFF(YEAR, e.birth, CURDATE())) as avg_age 
        FROM employee e 
        JOIN branch b ON e.branch_id = b.b_id
        WHERE 1=1 {f} 
        GROUP BY e.branch_id, b.location
    """
    
    df = pd.read_sql(query, engine)
    
    # 3. Chart now uses 'Name' for the x-axis
    chart = generate_chart(df, 'bar', 'Avg Employee Age', x='Name', y='avg_age')
    
    return {"data": safe_to_dict(df.round(1)), "warnings": [], "chart": chart}

def get_branch_new_hires_recent(uid):
    ctx = get_user_context(uid)
    f = get_hr_scope_filter(ctx, 'e')
    df = pd.read_sql(f"SELECT e.branch_id, e.emp_id, e.first_name, e.hired FROM employee e WHERE e.hired >= DATE_SUB(CURDATE(), INTERVAL 60 DAY) {f}", engine)
    return {"data": safe_to_dict(df), "warnings": [], "chart": None}

def get_branch_late_arrivals_today(uid):
    ctx = get_user_context(uid)
    f = get_hr_scope_filter(ctx, 'e')
    query = f"SELECT e.branch_id, l.emp_id, l.clock_in FROM adherence_log l JOIN employee e ON l.emp_id = e.emp_id WHERE DATE(l.clock_in) = CURDATE() AND l.leave_type = 'lateness' {f}"
    df = pd.read_sql(query, engine)
    return {"data": safe_to_dict(df), "warnings": [], "chart": None}

def get_branch_unpaid_leave_total(uid):
    ctx = get_user_context(uid)
    f = get_hr_scope_filter(ctx, 'e')
    
    # 1. Added JOIN to branch br (using 'br' because 'b' is already adherence_balance)
    query = f"""
        SELECT 
            e.branch_id, 
            br.location AS Name,
            SUM(b.upl) as total_upl 
        FROM adherence_balance b 
        JOIN employee e ON b.employee_id = e.emp_id 
        JOIN branch br ON e.branch_id = br.b_id
        WHERE 1=1 {f} 
        GROUP BY e.branch_id, br.location
    """
    
    df = pd.read_sql(query, engine)
    
    # 2. Chart now uses 'Name' for the x-axis
    chart = generate_chart(df, 'bar', 'Unpaid Leave Volume', x='Name', y='total_upl')
    
    return {"data": safe_to_dict(df), "warnings": [], "chart": chart}

def get_branch_excuse_usage(uid):
    ctx = get_user_context(uid)
    f = get_hr_scope_filter(ctx, 'e')
    
    # 1. Added JOIN to branch br 
    query = f"""
        SELECT 
            e.branch_id, 
            br.location AS Name,
            SUM(b.excuse) as total_excuses 
        FROM adherence_balance b 
        JOIN employee e ON b.employee_id = e.emp_id 
        JOIN branch br ON e.branch_id = br.b_id
        WHERE 1=1 {f} 
        GROUP BY e.branch_id, br.location
    """
    
    df = pd.read_sql(query, engine)
    
    # 2. Chart now uses 'Name' for the x-axis
    chart = generate_chart(df, 'bar', 'Excuse Leave Volume', x='Name', y='total_excuses')
    
    return {"data": safe_to_dict(df), "warnings": [], "chart": chart}

def get_branch_gender_pay_gap(uid):
    ctx = get_user_context(uid)
    f = get_hr_scope_filter(ctx, 'e')
    
    query = f"""
        SELECT e.branch_id, b.location as Name, e.gender, AVG(e.salary) as avg_salary 
        FROM employee e 
        JOIN branch b ON e.branch_id = b.b_id
        WHERE 1=1 {f} 
        GROUP BY e.branch_id, b.location, e.gender
    """
    df = pd.read_sql(query, engine)
    
    # The chart shows the gap by gender, data table provides location context
    chart = generate_chart(df, 'bar', 'Gender Pay Breakdown', x='gender', y='avg_salary')
    return {"data": safe_to_dict(df.round(2)), "warnings": [], "chart": chart}



def get_branch_upcoming_birthdays(uid):
    ctx = get_user_context(uid)
    f = get_hr_scope_filter(ctx, 'e')
    
    # 1. Added JOIN to branch b for branch_name
    # 2. Used CONCAT to get the full employee_name
    # 3. Added ORDER BY DAY() to sort by upcoming dates
    query = f"""
        SELECT 
            e.branch_id, 
            b.location AS branch_name,
            e.emp_id, 
            CONCAT(e.first_name, ' ', e.last_name) AS employee_name, 
            e.birth 
        FROM employee e 
        JOIN branch b ON e.branch_id = b.b_id
        WHERE MONTH(e.birth) = MONTH(CURDATE()) {f}
        ORDER BY DAY(e.birth) ASC
    """
    
    df = pd.read_sql(query, engine)
    data = safe_to_dict(df)
    
    # Added a cheerful summary for the UI to show how many birthdays there are
    warnings = []
    if len(data) > 0:
        warnings.append(f"CELEBRATION: There are {len(data)} upcoming birthdays this month!")
        
    return {
        "data": data, 
        "warnings": warnings, 
        "chart": None
    }

#====================================================================================
# NEW SCHEMA FUNCTIONS: DEPTH & COMPLIANCE & FORECASTING
#====================================================================================

#this function must give the ablity to the user to choose month and year
def get_branch_lateness_trends(uid, selected_month, selected_year):
    ctx = get_user_context(uid)
    f = get_hr_scope_filter(ctx, 'e')
    
    # 1. Added JOIN to branch b for location
    # 2. Used CONCAT for employee full name
    # 3. Parameterized the query with %(year)s and %(month)s to allow user selection
    query = f"""
        SELECT 
            e.branch_id, 
            b.location AS branch_name,
            l.emp_id,
            CONCAT(e.first_name, ' ', e.last_name) AS employee_name,
            l.leave_date
        FROM adherence_log l 
        JOIN employee e ON l.emp_id = e.emp_id 
        JOIN branch b ON e.branch_id = b.b_id
        WHERE l.leave_type = 'lateness' 
          AND YEAR(l.leave_date) = %(year)s
          AND MONTH(l.leave_date) = %(month)s {f}
        ORDER BY l.leave_date DESC
    """
    
    # Pass the user's selected date safely into the query
    params = {'month': selected_month, 'year': selected_year}
    df = pd.read_sql(query, engine, params=params)
    data = safe_to_dict(df)
    
    # Create a dynamic warning summary
    warnings = []
    if len(data) > 0:
        warnings.append(f"REPORT: {len(data)} lateness incidents recorded in your branches for {selected_month}/{selected_year}.")
        
    # Generate a leaderboard to show who was late the most in this specific period
    chart = None
    if not df.empty:
        trend_df = df.groupby('employee_name').size().reset_index(name='lateness_count')
        chart = generate_chart(trend_df, 'leaderboard', f'Lateness Leaderboard ({selected_month}/{selected_year})', x='employee_name', y='lateness_count')
        
    return {
        "data": data, 
        "warnings": warnings, 
        "chart": chart
    }

def get_branch_leave_ticket_compliance(uid):
    ctx = get_user_context(uid)
    f = get_hr_scope_filter(ctx, 'e')
    
    # 1. Added branch location and full name concatenation
    # 2. Filtered for the CURRENT MONTH (as per your previous requests)
    query = f"""
        SELECT 
            e.branch_id, 
            b.location,
            l.emp_id, 
            CONCAT(e.first_name, ' ', e.last_name) AS name, 
            l.leave_date, 
            l.leave_type 
        FROM adherence_log l 
        JOIN employee e ON l.emp_id = e.emp_id 
        JOIN branch b ON e.branch_id = b.b_id
        LEFT JOIN ticket t ON t.employee_id = l.emp_id AND DATE(t.time) = DATE_SUB(l.leave_date, INTERVAL 1 DAY)
        WHERE l.leave_type NOT IN ('lateness', 'off') AND l.leave_type IS NOT NULL 
          AND t.ticket_id IS NULL 
          AND YEAR(l.leave_date) = YEAR(CURDATE())
          AND MONTH(l.leave_date) = MONTH(CURDATE()) {f}
    """
    
    df = pd.read_sql(query, engine)
    data = safe_to_dict(df)
    
    # 3. Create a single summary warning instead of multiple boxes
    warnings = []
    if len(data) > 0:
        warnings.append(f"WARNING: Total of {len(data)} non-compliant leaves detected without prior tickets this month.")
    
    return {
        "data": data, 
        "warnings": warnings, 
        "chart": None
    }

def get_branch_remaining_balances(uid):
    ctx = get_user_context(uid)
    f = get_hr_scope_filter(ctx, 'e')
    
    # 1. Added JOIN to branch br
    # 2. Selected br.location AS Name and added to GROUP BY
    query = f"""
        SELECT 
            e.branch_id, 
            br.location AS Name,
            AVG(b.total_annual_left) as avg_annual_left, 
            AVG(b.total_sick_left) as avg_sick_left, 
            AVG(b.total_excuse_left) as avg_excuse_left
        FROM adherence_balance b 
        JOIN employee e ON b.employee_id = e.emp_id 
        JOIN branch br ON e.branch_id = br.b_id
        WHERE 1=1 {f} 
        GROUP BY e.branch_id, br.location
    """
    df = pd.read_sql(query, engine)
    
    chart = None
    if not df.empty:
        # 3. Added 'Name' to id_vars so the melted dataframe retains the branch location
        melted = df.melt(
            id_vars=['branch_id', 'Name'], 
            value_vars=['avg_annual_left', 'avg_sick_left', 'avg_excuse_left'], 
            var_name='balance_type', 
            value_name='avg_remaining'
        )
        chart = generate_chart(melted, 'bar', 'Avg Remaining Balances', x='balance_type', y='avg_remaining')
        
    return {"data": safe_to_dict(df.round(1)), "warnings": [], "chart": chart}



#===============================================================================
# 4. EXECUTION WRAPPERS
#===============================================================================

def run_all_hr_branch_metrics(user_id, lateness_month=None, lateness_year=None):
    import datetime
    now = datetime.date.today()
    lat_month = lateness_month or now.month
    lat_year = lateness_year or now.year

    results = {}
    branch_funcs = [
        get_branch_headcount, get_branch_payroll, get_branch_avg_salary, 
        get_branch_avg_tenure, get_branch_gender_distribution,
        get_branch_flight_risk, get_branch_burnout_risk, get_branch_high_absenteeism, 
        get_branch_avg_sick_days, get_branch_total_expenses, get_branch_top_expense_claimers, 
        get_branch_ticket_volume, get_branch_unresolved_tickets, get_branch_avg_age, 
        get_branch_new_hires_recent, get_branch_late_arrivals_today, get_branch_unpaid_leave_total, 
        get_branch_excuse_usage, get_branch_gender_pay_gap, 
        get_branch_upcoming_birthdays, 
        get_branch_leave_ticket_compliance, 
        get_branch_remaining_balances
    ]
    
    for func in branch_funcs:
        try: results[func.__name__] = func(user_id)
        except Exception as e: results[func.__name__] = {"data": [], "warnings": [f"Error: {str(e)}"], "chart": None}

    # Lateness trends needs month/year params
    try:
        results['get_branch_lateness_trends'] = get_branch_lateness_trends(user_id, lat_month, lat_year)
    except Exception as e:
        results['get_branch_lateness_trends'] = {"data": [], "warnings": [f"Error: {str(e)}"], "chart": None}
            
    return results

#===============================================================================
# 5. NODE.JS EXECUTION BRIDGE & TESTING
#===============================================================================

if __name__ == "__main__":
    try:
        if len(sys.argv) > 2:
            emp_id = int(sys.argv[1])
            exec_type = sys.argv[2].lower()
        else:
            emp_id = 6265 
            exec_type = "branch"

        # Parse optional lateness_month and lateness_year from extra args
        lateness_month = None
        lateness_year = None
        for arg in sys.argv[3:]:
            if arg.startswith('lateness_month='):
                try: lateness_month = int(arg.split('=')[1])
                except: pass
            elif arg.startswith('lateness_year='):
                try: lateness_year = int(arg.split('=')[1])
                except: pass

        if exec_type == 'manager' or exec_type == 'branch':
            results = run_all_hr_branch_metrics(emp_id, lateness_month, lateness_year) 
        else:
            results = {}

        save_json_to_text(results, "hr_employee_output.txt")
        print(json.dumps(results, indent=4))

    except Exception as e:
        error_json = {"error": str(e)}
        save_json_to_text(error_json, "dashboard_error_log.txt")
        print(json.dumps(error_json, indent=4))