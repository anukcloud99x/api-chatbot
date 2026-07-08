import pandas as pd
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity
import numpy as np


class Chatbot:
    def __init__(self, file_path):
        self.faqs = pd.read_csv(file_path)
        self.vectorizer = TfidfVectorizer()
        self.company_name = None
        self.kb_vectors = None
        self.company_faqs = None

    def filter_by_company(self, df,company_name):
        """Filter FAQs by company name"""
        return df[df['company'] == company_name]
    
    def set_company(self, company_name):
        """Set current company and prepare it's vectors"""
        self.company_name = company_name
        self.company_faqs = self.filter_by_company(self.faqs, company_name)
        
        # If the mentioned company doensn't have any faqs
        if len(self.company_faqs) == 0:
            print(f"No FAQs found for company: {company_name}")
            return False
        
        # Get questions and create vectors
        questions = self.company_faqs['question'].tolist()
        self.kb_vectors = self.vectorizer.fit_transform(questions)
        return True
    
    def user_input(self):
        """Get user input"""
        return input("You:")

    def get_user_vector(self, user_question):
        """Convert user question to vector"""
        #Fit transform creates a new space from the beginning
        return self.vectorizer.transform([user_question]) # transform fits it into the existing vector space, no need to fit transform 
    
    
    def find_best_match (self, user_question):
        """Find the best matching FAQ for a user question"""

        user_vector = self.get_user_vector(user_question)
        
        # Calculate the cosine similarity for all kb vectors and user vector
        similarities = cosine_similarity(user_vector, self.kb_vectors)

        # Get the index with the highest score
        best_index = np.argmax(similarities)
        best_score = similarities[0][best_index]

        # Get corresponding question and answer
        best_question = self.company_faqs.iloc[best_index]['question']
        best_answer = self.company_faqs.iloc[best_index]['answer']

        return {
            'question': best_question,
            'answer': best_answer,
            'score': best_score,
            'index': best_index
        }
    
    def get_response(self, user_question, threshold= 0.6):
        """Get chatbot response. Returns answer if confidence is above threshold"""
        print()#

        print(f"User question: {user_question}") #
       

        if self.kb_vectors is None:
            return "Company not selected"
        
        result = self.find_best_match(user_question)

        if result['score'] >= threshold:
            print(f"Best match: {result['question']}") #
            print(f"Answer: {result['answer']}")#
            print(f"Confidence: {result['score']}") #
            return result['answer']
        else:
            print(f"Best match: {result['question']}") #
            print(f"Answer:","I'm sorry, I don't have an answer for that question. Please contact our support team directly for assistance.")#
            print(f"Confidence: {result['score']}") #
            return "I'm sorry, I don't have an answer for that question. Please contact our support team directly for assistance."
    
        
bot = Chatbot('faqs.csv')

bot.set_company('connect_bpo')

queries = {
    "What do you guys do?",
    "What kind of services do you provide?",
    "Do you have IT support?",
    "Can you handle my IT needs?",
    "How can I reach you?",
    "What's your phone number?",
    "What do you charge?",
    "How much does it cost?",
    "Where's your office?"
}

for i in queries:
    response = bot.get_response(i)


        


    
    




