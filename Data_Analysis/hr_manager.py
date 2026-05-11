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

def save_json_to_text(data, filename="hr_manager_output.txt"):
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

def require_manager(context):
    current_role = str(context.get('role', '')).lower()
    allowed_roles = ['hr_manager', 'global_manager', 'manager', 'dep_manager', 'hr', 'admin']
    
    if current_role not in allowed_roles:
        raise PermissionError(f"Access Denied: Your role is '{current_role}'. You need to be a Manager.")

def get_hr_scope_filter(context, emp_table_alias='e'):
    b_id = context['branch_id']
    sb_id = context.get('secondary_branch_id')
    
    valid_branches = [str(int(b_id))]
    if pd.notna(sb_id) and sb_id is not None and str(sb_id).strip().upper() not in ['NULL', 'NONE', '']:
        valid_branches.append(str(int(float(sb_id))))
        
    branches_str = ",".join(valid_branches)
    return f" AND ({emp_table_alias}.branch_id IN ({branches_str}) OR {emp_table_alias}.secondary_branch_id IN ({branches_str})) "

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

# ==========================================
# 3. GLOBAL HR MANAGER FUNCTIONS (1-25)
# ==========================================

def get_global_headcount(uid):
    require_manager(get_user_context(uid))
    
    # 1. Added JOIN branch b ON e.branch_id = b.b_id
    # 2. Added b.location to the SELECT and GROUP BY clauses
    query = """
        SELECT 
            e.branch_id, 
            b.location, 
            COUNT(e.emp_id) as headcount 
        FROM employee e
        JOIN branch b ON e.branch_id = b.b_id
        GROUP BY e.branch_id, b.location
    """
    
    df = pd.read_sql(query, engine)
    
    # Changed the x-axis to 'location' so your chart labels look clean and readable
    chart = generate_chart(df, 'bar', 'Global Headcount by Branch', x='location', y='headcount')
    
    return {"data": safe_to_dict(df), "warnings": [], "chart": chart}

def get_global_payroll_total(uid):
    require_manager(get_user_context(uid))
    
    # 1. Added a JOIN to the branch table (using 'b')
    # 2. Added b.location to the SELECT and GROUP BY clauses
    query = """
        SELECT 
            e.branch_id, 
            b.location as Name,
            SUM(e.salary) as branch_payroll 
        FROM employee e
        JOIN branch b ON e.branch_id = b.b_id
        GROUP BY e.branch_id, b.location
    """
    
    df = pd.read_sql(query, engine)
    data = safe_to_dict(df)
    
    warnings = evaluate_warnings(data, 'branch_payroll', 1000000, 'greater', "Critical: Branch Payroll Budget Exceeded")
    
    # 3. Changed x='branch_id' to x='location' so your chart labels are readable names
    chart = generate_chart(df, 'bar', 'Payroll Distribution by Branch', x='Name', y='branch_payroll')
    
    return {"data": data, "warnings": warnings, "chart": chart}

def get_global_avg_salary(uid):
    require_manager(get_user_context(uid))
    
    # Query per-department for chart display
    dept_query = """
        SELECT 
            e.departement_id, 
            d.name AS department_name,
            AVG(e.salary) as avg_salary 
        FROM employee e
        JOIN departement d ON e.departement_id = d.dep_id
        GROUP BY e.departement_id, d.name
    """
    df = pd.read_sql(dept_query, engine)
    
    # Overall company avg (true mean of all employees, not avg of dept avgs)
    overall_query = "SELECT AVG(salary) as overall_avg_salary FROM employee"
    overall_df = pd.read_sql(overall_query, engine)
    overall_avg = round(float(overall_df['overall_avg_salary'].iloc[0]), 2) if not overall_df.empty and overall_df['overall_avg_salary'].iloc[0] is not None else 0

    chart = generate_chart(df, 'bar', 'Average Salary per Department', x='department_name', y='avg_salary')
    
    return {
        "data": safe_to_dict(df.round(2)),
        "warnings": [],
        "chart": chart,
        "overall_avg_salary": overall_avg
    }

def get_global_avg_tenure(uid):
    require_manager(get_user_context(uid))
    
    # 1. Added a JOIN to the departement table (using 'd')
    # 2. Added d.name to the SELECT and GROUP BY clauses
    # (Note: Double-check that your department table's ID column is 'departement_id' and the name column is 'name'. Adjust if your schema uses 'dept_id' or 'dept_name')
    query = """
        SELECT 
            e.departement_id, 
            d.name AS department_name,
            AVG(TIMESTAMPDIFF(YEAR, e.hired, CURDATE())) as avg_tenure 
        FROM employee e 
        JOIN departement d ON e.departement_id = d.dep_id
        GROUP BY e.departement_id, d.name
    """
    
    df = pd.read_sql(query, engine)
    
    # 3. Changed x='departement_id' to x='department_name' so the chart uses the text labels
    chart = generate_chart(df, 'bar', 'Global Avg Tenure by Department', x='department_name', y='avg_tenure')
    
    data = safe_to_dict(df.round(1))
    warnings = evaluate_warnings(data, 'avg_tenure', 2.0, 'less', "Department retention is dangerously low")
    
    return {"data": data, "warnings": warnings, "chart": chart}

def get_global_gender_distribution(uid):
    require_manager(get_user_context(uid))
    df = pd.read_sql("SELECT gender, COUNT(emp_id) as count FROM employee GROUP BY gender", engine)
    chart = generate_chart(df, 'pie', 'Global Gender Distribution', names='gender', values='count')
    return {"data": safe_to_dict(df), "warnings": [], "chart": chart}

def get_global_department_headcounts(uid):
    require_manager(get_user_context(uid))
    
    # 1. Added JOIN departement d ON e.departement_id = d.dep_id
    # 2. Added d.name to the SELECT and GROUP BY clauses
    query = """
        SELECT 
            e.departement_id, 
            d.name AS department_name,
            COUNT(e.emp_id) as headcount 
        FROM employee e
        JOIN departement d ON e.departement_id = d.dep_id
        GROUP BY e.departement_id, d.name
    """
    
    df = pd.read_sql(query, engine)
    
    # 3. Changed x='departement_id' to x='department_name' for better chart labels
    chart = generate_chart(df, 'bar', 'Global Headcount by Department', x='department_name', y='headcount')
    
    return {"data": safe_to_dict(df), "warnings": [], "chart": chart}

def get_global_department_payroll(uid):
    require_manager(get_user_context(uid))
    
    # 1. Added JOIN departement d ON e.departement_id = d.dep_id
    # 2. Added d.name to the SELECT and GROUP BY clauses
    query = """
        SELECT 
            e.departement_id, 
            d.name AS department_name,
            SUM(e.salary) as dept_payroll 
        FROM employee e
        JOIN departement d ON e.departement_id = d.dep_id
        GROUP BY e.departement_id, d.name
    """
    
    df = pd.read_sql(query, engine)
    
    # 3. Changed x='departement_id' to x='department_name' for clean chart labels
    chart = generate_chart(df, 'bar', 'Payroll by Department', x='department_name', y='dept_payroll')
    
    return {"data": safe_to_dict(df.round(2)), "warnings": [], "chart": chart}

def get_global_flight_risk(uid):
    require_manager(get_user_context(uid))
    query = """
        SELECT emp_id, first_name, last_name, salary, TIMESTAMPDIFF(YEAR, hired, CURDATE()) as tenure_years 
        FROM employee 
        WHERE salary < (SELECT AVG(salary) FROM employee) AND TIMESTAMPDIFF(YEAR, hired, CURDATE()) >= 3
    """
    df = pd.read_sql(query, engine)
    data = safe_to_dict(df)
    return {"data": data, "warnings": ["High Flight Risk Detected"] if len(data) > 10 else [], "chart": None}

def get_global_burnout_risk(uid):
    # Assuming require_manager is a custom security check you built
    require_manager(get_user_context(uid)) 
    
    query = """
        SELECT e.emp_id, e.first_name, e.last_name, b.total_annual_left 
        FROM employee e 
        JOIN adherence_balance b ON e.emp_id = b.employee_id 
        WHERE b.total_annual_left < 3
    """
    df = pd.read_sql(query, engine)
    data = safe_to_dict(df)
    
    # 1. Create a custom alert for EVERY employee that triggered the SQL filter
    warnings = []
    for emp in data:
        alert_msg = f"ALERT: {emp['first_name']} {emp['last_name']} (ID: {emp['emp_id']}) is at severe burnout risk with only {emp['total_annual_left']} annual days left!"
        warnings.append(alert_msg)
        
    # 2. (Optional) You can still keep the total count at the top of the warnings list if you like
    if len(data) > 0:
        warnings.insert(0, f"SUMMARY: {len(data)} total employees require immediate attention.")
        
    return {"data": data, "warnings": warnings, "chart": None}

def get_global_high_absenteeism(uid):
    require_manager(get_user_context(uid))
    
    # 1. CONCAT names and JOIN branch for location
    # 2. Filter by current YEAR and MONTH
    # 3. Group by multiple columns to keep the data accessible in the SELECT
    query = """
        SELECT 
            e.emp_id, 
            CONCAT(e.first_name, ' ', e.last_name) AS name,
            b.location,
            COUNT(l.leave_date) as total_absences 
        FROM adherence_log l
        JOIN employee e ON l.emp_id = e.emp_id
        JOIN branch b ON e.branch_id = b.b_id
        WHERE l.leave_type IS NOT NULL 
          AND l.leave_type != 'off'
          AND YEAR(l.leave_date) = YEAR(CURDATE())
          AND MONTH(l.leave_date) = MONTH(CURDATE())
        GROUP BY e.emp_id, name, b.location
        HAVING total_absences > 5
        ORDER BY total_absences DESC
    """
    
    df = pd.read_sql(query, engine)
    data = safe_to_dict(df)
    
    # Create a summary warning for the top of the modal
    warnings = []
    if len(data) > 0:
        warnings.append(f"CRITICAL: {len(data)} employees have exceeded 5 absences this month.")
    
    # Generate a leaderboard chart to show top offenders
    chart = None
    if not df.empty:
        chart = generate_chart(df, 'leaderboard', 'Top Absenteeism Offenders', x='name', y='total_absences')
        
    return {
        "data": data, 
        "warnings": warnings, 
        "chart": chart
    }

def get_global_avg_sick_days(uid):
    require_manager(get_user_context(uid))
    
    # 1. Added JOIN departement d ON e.departement_id = d.dep_id
    # 2. Added d.name to the SELECT and GROUP BY clauses
    query = """
        SELECT 
            e.departement_id, 
            d.name AS department_name, 
            AVG(b.sick_days) as avg_sick 
        FROM adherence_balance b 
        JOIN employee e ON b.employee_id = e.emp_id 
        JOIN departement d ON e.departement_id = d.dep_id
        GROUP BY e.departement_id, d.name
    """
    
    df = pd.read_sql(query, engine)
    
    # 3. Changed x-axis to 'department_name' so the bar chart is readable
    chart = generate_chart(df, 'bar', 'Avg Sick Days by Department', x='department_name', y='avg_sick')
    
    return {"data": safe_to_dict(df.round(1)), "warnings": [], "chart": chart}

def get_global_total_expenses(uid):
    require_manager(get_user_context(uid))
    
    # 1. Added JOIN branch b ON e.branch_id = b.b_id
    # 2. Added b.location to the SELECT and GROUP BY clauses
    query = """
        SELECT 
            e.branch_id, 
            b.location as Name,
            SUM(ex.amount) as total_claimed 
        FROM employee_expenses_record ex 
        JOIN employee e ON ex.employee_id = e.emp_id 
        JOIN branch b ON e.branch_id = b.b_id
        GROUP BY e.branch_id, b.location
    """
    
    df = pd.read_sql(query, engine)
    
    # 3. Changed x='branch_id' to x='location' so your chart labels are readable names
    chart = generate_chart(df, 'bar', 'Global Expenses by Branch', x='Name', y='total_claimed')
    
    return {"data": safe_to_dict(df.round(2)), "warnings": [], "chart": chart}


#this function must be leadreboard not bar chart
def get_global_top_expense_claimers(uid):
    require_manager(get_user_context(uid))
    
    # 1. CONCAT first and last name
    # 2. JOIN departement d to get the name
    query = """
        SELECT 
            e.emp_id, 
            CONCAT(e.first_name, ' ', e.last_name) AS name,
            d.name AS department_name,
            SUM(ex.amount) as total_claimed 
        FROM employee e 
        JOIN employee_expenses_record ex ON e.emp_id = ex.employee_id 
        JOIN departement d ON e.departement_id = d.dep_id
        GROUP BY e.emp_id, name, department_name 
        ORDER BY total_claimed DESC 
        LIMIT 5
    """
    
    df = pd.read_sql(query, engine)
    
    chart = generate_chart(df, 'leaderboard', 'Top Global Expense Claimers', x='name', y='total_claimed')
    
    return {
        "data": safe_to_dict(df.round(2)), 
        "warnings": [], 
        "chart": chart
    }

def get_global_ticket_volume(uid):
    require_manager(get_user_context(uid))
    
    # Filtered for the current year and month
    query = """
        SELECT type, COUNT(ticket_id) as volume 
        FROM ticket 
        WHERE YEAR(time) = YEAR(CURDATE()) 
          AND MONTH(time) = MONTH(CURDATE()) 
        GROUP BY type
    """
    
    df = pd.read_sql(query, engine)
    chart = generate_chart(df, 'pie', 'Global Ticket Volume by Type (Current Month)', names='type', values='volume')
    
    return {"data": safe_to_dict(df), "warnings": [], "chart": chart}


#this function in dashboard show sum of ticket id i want it to show the number of the ticket that unresolved
def get_global_unresolved_tickets(uid):
    require_manager(get_user_context(uid))
    
    # 1. CAST(t.ticket_id AS CHAR) prevents the UI from doing math on the ID numbers
    # 2. Added '1 AS ticket_count' to give the UI a real metric to sum up
    query = """
        SELECT 
            CAST(t.ticket_id AS CHAR) AS ticket_id, 
            t.time, 
            t.type, 
            CONCAT(e.first_name, ' ', e.last_name) AS employee_name, 
            b.location as branch_name,
            1 AS ticket_count
        FROM ticket t 
        JOIN employee e ON t.employee_id = e.emp_id 
        JOIN branch b ON e.branch_id = b.b_id
        WHERE YEAR(t.time) = YEAR(CURDATE()) 
          AND MONTH(t.time) = MONTH(CURDATE())
        ORDER BY t.time ASC 
        
    """
    
    df = pd.read_sql(query, engine)
    data = safe_to_dict(df)
    
    warnings = []
    if len(data) > 10:
        warnings.append(f"ATTENTION: There are {len(data)} oldest tickets pending resolution from this month.")
        
    # 3. Generating a summary chart forces the UI to use 'ticket_count' for the big header
    chart = None
    if not df.empty:
        summary_df = df.groupby('type')['ticket_count'].sum().reset_index()
        chart = generate_chart(summary_df, 'pie', 'Unresolved Tickets by Type', names='type', values='ticket_count')
        
    return {
        "data": data,
        "warnings": warnings,
        "chart": chart,
        "total_count": len(data)
    }

def get_global_avg_age(uid):
    require_manager(get_user_context(uid))
    
    # 1. Added JOIN departement d ON e.departement_id = d.dep_id
    # 2. Added d.name as department_name to SELECT and GROUP BY
    query = """
        SELECT 
            e.departement_id, 
            d.name AS department_name, 
            AVG(TIMESTAMPDIFF(YEAR, e.birth, CURDATE())) as global_avg_age 
        FROM employee e
        JOIN departement d ON e.departement_id = d.dep_id
        GROUP BY e.departement_id, d.name
    """
    
    df = pd.read_sql(query, engine)
    
    # 3. Updated x-axis to use 'department_name' for better visualization
    chart = generate_chart(df, 'bar', 'Global Avg Age by Department', x='department_name', y='global_avg_age')
    
    return {"data": safe_to_dict(df.round(1)), "warnings": [], "chart": chart}

def get_global_retirement_eligibility(uid):
    require_manager(get_user_context(uid))
    query = "SELECT emp_id, first_name, last_name, TIMESTAMPDIFF(YEAR, birth, CURDATE()) as age FROM employee WHERE TIMESTAMPDIFF(YEAR, birth, CURDATE()) >= 60"
    df = pd.read_sql(query, engine)
    return {"data": safe_to_dict(df), "warnings": [], "chart": None}

def get_global_new_hires_ytd(uid):
    require_manager(get_user_context(uid))
    df = pd.read_sql("SELECT branch_id, COUNT(emp_id) as new_hires FROM employee WHERE YEAR(hired) = YEAR(CURDATE()) GROUP BY branch_id", engine)
    chart = generate_chart(df, 'bar', 'New Hires YTD by Branch', x='branch_id', y='new_hires')
    return {"data": safe_to_dict(df), "warnings": [], "chart": chart}

def get_global_late_arrivals_today(uid):
    require_manager(get_user_context(uid))
    query = "SELECT branch_id, COUNT(*) as late_count FROM adherence_log l JOIN employee e on l.emp_id=e.emp_id WHERE DATE(clock_in) = CURDATE() AND leave_type = 'lateness' GROUP BY branch_id"
    df = pd.read_sql(query, engine)
    chart = generate_chart(df, 'bar', 'Late Arrivals Today', x='branch_id', y='late_count')
    return {"data": safe_to_dict(df), "warnings": [], "chart": chart}

def get_global_unpaid_leave_total(uid):
    require_manager(get_user_context(uid))
    
    # 1. Joined departement table to get the name
    query = """
        SELECT 
            e.departement_id, 
            d.name AS department_name, 
            SUM(b.upl) as total_upl 
        FROM adherence_balance b 
        JOIN employee e ON b.employee_id = e.emp_id 
        JOIN departement d ON e.departement_id = d.dep_id
        GROUP BY e.departement_id, d.name
    """
    
    df = pd.read_sql(query, engine)
    
    # 2. Updated chart x-axis to 'department_name'
    chart = generate_chart(df, 'bar', 'Unpaid Leave Volume by Department', x='department_name', y='total_upl')
    
    return {"data": safe_to_dict(df), "warnings": [], "chart": chart}

def get_global_excuse_usage(uid):
    require_manager(get_user_context(uid))
    
    # 1. Joined departement table to get the name
    query = """
        SELECT 
            e.departement_id, 
            d.name AS department_name, 
            SUM(b.excuse) as total_excuses 
        FROM adherence_balance b 
        JOIN employee e ON b.employee_id = e.emp_id 
        JOIN departement d ON e.departement_id = d.dep_id
        GROUP BY e.departement_id, d.name
    """
    
    df = pd.read_sql(query, engine)
    
    # 2. Updated chart x-axis to 'department_name'
    chart = generate_chart(df, 'bar', 'Excuse Leave Volume by Department', x='department_name', y='total_excuses')
    return {"data": safe_to_dict(df), "warnings": [], "chart": chart}

def get_global_gender_pay_gap(uid):
    require_manager(get_user_context(uid))
    df = pd.read_sql("SELECT gender, AVG(salary) as avg_salary FROM employee GROUP BY gender", engine)
    chart = generate_chart(df, 'bar', 'Global Gender Pay Breakdown', x='gender', y='avg_salary')
    return {"data": safe_to_dict(df.round(2)), "warnings": [], "chart": chart}



def get_global_upcoming_birthdays(uid):
    require_manager(get_user_context(uid))
    
    # 1. Added JOIN to branch b to get the location
    # 2. Added e.branch_id to the SELECT clause
    # 3. Used CONCAT to create a full employee_name
    # 4. Added ORDER BY DAY() to sort birthdays chronologically
    query = """
        SELECT 
            e.branch_id,
            b.location AS branch_name,
            e.emp_id, 
            CONCAT(e.first_name, ' ', e.last_name) AS employee_name, 
            e.birth 
        FROM employee e
        JOIN branch b ON e.branch_id = b.b_id
        WHERE MONTH(e.birth) = MONTH(CURDATE())
        ORDER BY DAY(e.birth) ASC
    """
    
    df = pd.read_sql(query, engine)
    data = safe_to_dict(df)
    
    # Added a cheerful global summary for the top of the UI
    warnings = []
    if len(data) > 0:
        warnings.append(f"CELEBRATION: There are {len(data)} upcoming birthdays company-wide this month!")
        
    return {
        "data": data, 
        "warnings": warnings, 
        "chart": None
    }



#====================================================================================
# NEW SCHEMA FUNCTIONS: DEPTH & COMPLIANCE & FORECASTING
#====================================================================================


#this function must give the ablity to the user to choose month and year and update that in dashboard
def get_global_lateness_trends(uid, selected_month, selected_year):
    require_manager(get_user_context(uid))
    
    # We use parameters %(month)s and %(year)s to safely pass user input
    # Added JOINs to get the Full Name and Branch Location
    query = """
        SELECT 
            l.emp_id,
            CONCAT(e.first_name, ' ', e.last_name) AS name,
            b.location,
            l.leave_date,
            DATE_FORMAT(l.leave_date, '%%Y-%%m') as month
        FROM adherence_log l
        JOIN employee e ON l.emp_id = e.emp_id
        JOIN branch b ON e.branch_id = b.b_id
        WHERE l.leave_type = 'lateness' 
          AND YEAR(l.leave_date) = %(year)s
          AND MONTH(l.leave_date) = %(month)s
        ORDER BY l.leave_date DESC
    """
    
    params = {'month': selected_month, 'year': selected_year}
    df = pd.read_sql(query, engine, params=params)
    data = safe_to_dict(df)
    
    # 1. Provide a summary warning for the chosen period
    warnings = []
    if len(data) > 0:
        warnings.append(f"REPORT: Total of {len(data)} lateness incidents recorded for {selected_month}/{selected_year}.")
    
    # 2. Generate a leaderboard to show who was late the most in that specific month
    chart = None
    if not df.empty:
        # Grouping by name to see frequency per person for the chart
        trend_df = df.groupby('name').size().reset_index(name='lateness_count')
        chart = generate_chart(trend_df, 'leaderboard', f'Lateness Leaderboard ({selected_month}/{selected_year})', x='name', y='lateness_count')

    return {
        "data": data, 
        "warnings": warnings, 
        "chart": chart
    }

def get_global_leave_ticket_compliance(uid):
    require_manager(get_user_context(uid))
    
    # 1. Added JOIN branch b ON e.branch_id = b.b_id
    # 2. Added b.location to the SELECT list
    query = """
        SELECT 
            l.emp_id, 
            e.branch_id,
            b.location,
            CONCAT(e.first_name, ' ', e.last_name) AS name,
            DATE_FORMAT(l.leave_date, '%%Y-%%m') AS month,
            l.leave_date, 
            l.leave_type 
        FROM adherence_log l 
        JOIN employee e ON l.emp_id = e.emp_id 
        JOIN branch b ON e.branch_id = b.b_id
        LEFT JOIN ticket t ON t.employee_id = l.emp_id AND DATE(t.time) = DATE_SUB(l.leave_date, INTERVAL 1 DAY)
        WHERE l.leave_type NOT IN ('lateness', 'off') AND l.leave_type IS NOT NULL 
          AND t.ticket_id IS NULL 
          AND YEAR(l.leave_date) = YEAR(CURDATE()) 
          AND MONTH(l.leave_date) = MONTH(CURDATE())
        ORDER BY l.leave_date DESC
    """
    
    df = pd.read_sql(query, engine)
    data = safe_to_dict(df)
    
    warnings = []
    
    if len(data) > 0:
        warnings.append(f"WARNING: Total of {len(data)} non-compliant leaves detected without prior tickets this month.")
        
    chart = None
    if not df.empty:
        monthly_trend = df.groupby('month').size().reset_index(name='incidents')
        chart = generate_chart(monthly_trend, 'bar', 'Monthly Compliance Issues', x='month', y='incidents')

    return {
        "data": data, 
        "warnings": warnings, 
        "chart": chart,
        "total_issues": len(data)
    }

def get_global_remaining_balances(uid):
    require_manager(get_user_context(uid))
    query = """
        SELECT AVG(total_annual_left) as avg_annual_left, AVG(total_sick_left) as avg_sick_left, AVG(total_excuse_left) as avg_excuse_left
        FROM adherence_balance
    """
    df = pd.read_sql(query, engine)
    chart = None
    if not df.empty:
        df['global'] = 'Company Average'
        melted = df.melt(id_vars=['global'], value_vars=['avg_annual_left', 'avg_sick_left', 'avg_excuse_left'], var_name='balance_type', value_name='avg_remaining')
        chart = generate_chart(melted, 'bar', 'Global Avg Remaining Balances', x='balance_type', y='avg_remaining')
        
    return {"data": safe_to_dict(df.round(1)), "warnings": [], "chart": chart}



# ==========================================
# 5. EXECUTION WRAPPERS
# ==========================================

def run_all_hr_manager_metrics(user_id, lateness_month=None, lateness_year=None):
    import datetime
    now = datetime.date.today()
    lat_month = lateness_month or now.month
    lat_year = lateness_year or now.year

    results = {}
    manager_funcs = [
        get_global_headcount, get_global_payroll_total, get_global_avg_salary, 
        get_global_avg_tenure, get_global_gender_distribution, get_global_department_headcounts, 
        get_global_department_payroll, get_global_flight_risk, get_global_burnout_risk, 
        get_global_high_absenteeism, get_global_avg_sick_days, get_global_total_expenses, 
        get_global_top_expense_claimers, get_global_ticket_volume, get_global_unresolved_tickets, 
        get_global_avg_age, get_global_retirement_eligibility, get_global_new_hires_ytd, 
        get_global_late_arrivals_today, get_global_unpaid_leave_total, get_global_excuse_usage, 
        get_global_gender_pay_gap, get_global_upcoming_birthdays, 
        get_global_leave_ticket_compliance,
        get_global_remaining_balances
    ]
    
    for func in manager_funcs:
        try: results[func.__name__] = func(user_id)
        except Exception as e: results[func.__name__] = {"data": [], "warnings": [f"Error: {str(e)}"], "chart": None}

    # Lateness trends needs month/year params
    try:
        results['get_global_lateness_trends'] = get_global_lateness_trends(user_id, lat_month, lat_year)
    except Exception as e:
        results['get_global_lateness_trends'] = {"data": [], "warnings": [f"Error: {str(e)}"], "chart": None}
            
    return results

# ==========================================
# 6. NODE.JS EXECUTION BRIDGE & TESTING
# ==========================================
if __name__ == "__main__":
    try:
        if len(sys.argv) > 2:
            emp_id = int(sys.argv[1])
            exec_type = sys.argv[2].lower()
        else:
            emp_id = 6640 
            exec_type = "manager"

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

        if exec_type == 'manager':
            results = run_all_hr_manager_metrics(emp_id, lateness_month, lateness_year) 

        # Save the output to a text file
        save_json_to_text(results, "hr_manager_output.txt")

        # Print as formatted JSON so Node.js can read it
        print(json.dumps(results, indent=4))

    except Exception as e:
        error_json = {"error": str(e)}
        save_json_to_text(error_json, "dashboard_error_log.txt")
        print(json.dumps(error_json, indent=4))