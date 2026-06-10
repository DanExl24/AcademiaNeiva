import re
import csv
import os

def parse_md_to_jira_csv(md_file_path, csv_file_path):
    with open(md_file_path, 'r', encoding='utf-8') as f:
        content = f.read()

    # Regex to find each user story section starting with ## [ID]: [Title]
    # Example: ## AUTH01: Autenticación y Login Multi-Rol
    story_pattern = re.compile(r'## ([\w-]+): (.*?)\n\n\*\*Estado:\*\* (.*?) \| \*\*Prioridad:\*\* (.*?)\n\n### Historia de Usuario\n\n(.*?)\n\n### Criterios de Aceptación\n\n(.*?)(?=\n\n---|\n\n##|$)', re.DOTALL)
    
    stories = story_pattern.findall(content)
    
    with open(csv_file_path, 'w', encoding='utf-8', newline='') as csvfile:
        fieldnames = ['Issue ID', 'Summary', 'Issue Type', 'Status', 'Priority', 'Description', 'Acceptance Criteria']
        writer = csv.DictWriter(csvfile, fieldnames=fieldnames)
        
        writer.writeheader()
        for s_id, title, status, priority, description, criteria in stories:
            # Clean up the description
            desc_clean = description.strip()
            
            # Clean up the criteria
            criteria_clean = criteria.strip()
            
            writer.writerow({
                'Issue ID': s_id,
                'Summary': title.strip(),
                'Issue Type': 'Story',
                'Status': status.strip(),
                'Priority': priority.strip(),
                'Description': desc_clean,
                'Acceptance Criteria': criteria_clean
            })

if __name__ == "__main__":
    base_path = r"c:\Users\alejo\Downloads\segundoProyecto\guides\HistoriasUsuario"
    md_input = os.path.join(base_path, "JiraHUcomplementos.md")
    csv_output = os.path.join(base_path, "JiraHUcomplementos.csv")
    
    if os.path.exists(md_input):
        parse_md_to_jira_csv(md_input, csv_output)
        print(f"Successfully converted {md_input} to {csv_output}")
    else:
        print(f"Error: {md_input} not found.")
