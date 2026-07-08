import pandas as pd
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity
import numpy as np
import os

class ChatbotService:
    def __init__(self, faqs_folder='faqs'):
        self.faqs_folder = faqs_folder
        if not os.path.exists(self.faqs_folder):
            os.makedirs(self.faqs_folder)
            
        self.vectorizer = TfidfVectorizer()
        self.company_name = None
        self.kb_vectors = None
        self.company_faqs = None
        self.available_companies = self._get_available_companies()
        self.load_data()

    def _get_available_companies(self):
        """Get list of all available companies from CSV files."""
        companies = []
        if os.path.exists(self.faqs_folder):
            for file in os.listdir(self.faqs_folder):
                if file.endswith('.csv') and file != 'faqs.csv':
                    company_name = file.replace(".csv", '')
                    companies.append(company_name)
        return sorted(companies)

    def load_data(self):
        """Reload active company data if it is set"""
        self.available_companies = self._get_available_companies()
        if self.company_name:
            self.set_company(self.company_name)

    def get_companies(self):
        """Get list of unique company names"""
        return self.available_companies

    def filter_by_company(self, company_name):
        """Filter FAQs by company name"""
        filepath = os.path.join(self.faqs_folder, f"{company_name}.csv")
        if os.path.exists(filepath):
            try:
                return pd.read_csv(filepath)
            except Exception:
                return pd.DataFrame(columns=['company', 'question', 'answer'])
        return pd.DataFrame(columns=['company', 'question', 'answer'])
    
    def set_company(self, company_name):
        """Set current company and prepare its vectors"""
        self.company_name = company_name
        self.company_faqs = self.filter_by_company(company_name)
        
        # Clean columns
        if len(self.company_faqs) > 0:
            self.company_faqs['company'] = self.company_faqs['company'].fillna('').astype(str).str.strip()
            self.company_faqs['question'] = self.company_faqs['question'].fillna('').astype(str).str.strip()
            self.company_faqs['answer'] = self.company_faqs['answer'].fillna('').astype(str).str.strip()
            
            # Extract questions and create vectors
            questions = self.company_faqs['question'].tolist()
            self.vectorizer = TfidfVectorizer()
            self.kb_vectors = self.vectorizer.fit_transform(questions)
            return True
        else:
            self.kb_vectors = None
            return False

    def get_all_faqs(self):
        """Return all FAQs from all company CSV files with string IDs (company:row_index)"""
        faq_list = []
        for company in self.available_companies:
            df = self.filter_by_company(company)
            for idx, row in df.iterrows():
                faq_list.append({
                    'id': f"{company}:{idx}",
                    'company': company,
                    'question': row.get('question', ''),
                    'answer': row.get('answer', '')
                })
        return faq_list

    def find_best_match(self, user_question):
        """Find the best matching FAQ for a user question"""
        if self.kb_vectors is None or self.company_faqs is None or len(self.company_faqs) == 0:
            return None

        # Convert user question to vector
        user_vector = self.vectorizer.transform([user_question])
        
        # Calculate cosine similarity
        similarities = cosine_similarity(user_vector, self.kb_vectors)
        best_index = int(np.argmax(similarities))
        best_score = float(similarities[0][best_index])

        # Get matching details from company-filtered subset
        matched_row = self.company_faqs.iloc[best_index]
        
        return {
            'question': matched_row['question'],
            'answer': matched_row['answer'],
            'score': best_score,
            'id': f"{self.company_name}:{best_index}"
        }
    
    def get_response(self, user_question, company_name=None, threshold=0.6):
        """Get response and score for a user question"""
        if company_name is not None and company_name != self.company_name:
            self.set_company(company_name)
            
        if self.kb_vectors is None or self.company_faqs is None or len(self.company_faqs) == 0:
            return {
                'answer': "I'm sorry, I don't have any knowledge base loaded for this company.",
                'matched_question': None,
                'score': 0.0,
                'fallback': True
            }
        
        result = self.find_best_match(user_question)
        if not result:
            return {
                'answer': "I'm sorry, I don't have any data for this company yet.",
                'matched_question': None,
                'score': 0.0,
                'fallback': True
            }

        if result['score'] >= threshold:
            return {
                'answer': result['answer'],
                'matched_question': result['question'],
                'score': result['score'],
                'fallback': False
            }
        else:
            return {
                'answer': "I'm sorry, I don't have an answer for that question. Please contact our support team directly for assistance.",
                'matched_question': result['question'],
                'score': result['score'],
                'fallback': True
            }

    def add_faq(self, company, question, answer):
        """Add a new FAQ to the company's CSV file"""
        company = company.strip().lower().replace(' ', '_')
        filepath = os.path.join(self.faqs_folder, f"{company}.csv")
        
        if os.path.exists(filepath):
            try:
                df = pd.read_csv(filepath)
            except Exception:
                df = pd.DataFrame(columns=['company', 'question', 'answer'])
        else:
            df = pd.DataFrame(columns=['company', 'question', 'answer'])
            
        new_row = pd.DataFrame([{
            'company': company,
            'question': question.strip(),
            'answer': answer.strip()
        }])
        df = pd.concat([df, new_row], ignore_index=True)
        df.to_csv(filepath, index=False)
        self.load_data()
        return True

    def update_faq(self, faq_id, company, question, answer):
        """Update an existing FAQ, handling moving across company files if changed"""
        try:
            old_company, idx_str = faq_id.split(':')
            idx = int(idx_str)
        except (ValueError, AttributeError):
            return False
            
        old_filepath = os.path.join(self.faqs_folder, f"{old_company}.csv")
        if not os.path.exists(old_filepath):
            return False
            
        try:
            df_old = pd.read_csv(old_filepath)
        except Exception:
            return False
            
        if idx not in df_old.index:
            return False
            
        new_company = company.strip().lower().replace(' ', '_')
        
        if new_company == old_company:
            # Same company, update in place
            df_old.at[idx, 'question'] = question.strip()
            df_old.at[idx, 'answer'] = answer.strip()
            df_old.to_csv(old_filepath, index=False)
        else:
            # Company changed. Remove from old, append to new.
            df_old = df_old.drop(idx).reset_index(drop=True)
            df_old.to_csv(old_filepath, index=False)
            
            # If old file is empty, delete it
            if len(df_old) == 0:
                try:
                    os.remove(old_filepath)
                except OSError:
                    pass
                    
            # Write to new company file
            new_filepath = os.path.join(self.faqs_folder, f"{new_company}.csv")
            if os.path.exists(new_filepath):
                try:
                    df_new = pd.read_csv(new_filepath)
                except Exception:
                    df_new = pd.DataFrame(columns=['company', 'question', 'answer'])
            else:
                df_new = pd.DataFrame(columns=['company', 'question', 'answer'])
                
            new_row = pd.DataFrame([{
                'company': new_company,
                'question': question.strip(),
                'answer': answer.strip()
            }])
            df_new = pd.concat([df_new, new_row], ignore_index=True)
            df_new.to_csv(new_filepath, index=False)
            
        self.load_data()
        return True

    def delete_faq(self, faq_id):
        """Delete an FAQ from its company CSV file"""
        try:
            company, idx_str = faq_id.split(':')
            idx = int(idx_str)
        except (ValueError, AttributeError):
            return False
            
        filepath = os.path.join(self.faqs_folder, f"{company}.csv")
        if not os.path.exists(filepath):
            return False
            
        try:
            df = pd.read_csv(filepath)
        except Exception:
            return False
            
        if idx not in df.index:
            return False
            
        df = df.drop(idx).reset_index(drop=True)
        df.to_csv(filepath, index=False)
        
        if len(df) == 0:
            try:
                os.remove(filepath)
            except OSError:
                pass
                
        self.load_data()
        return True
