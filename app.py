from flask import Flask, request, jsonify, render_template, send_from_directory
import os
import json
import datetime
from chatbot import ChatbotService

app = Flask(__name__, static_folder='static', template_folder='templates')
chatbot_service = ChatbotService('faqs')
HISTORY_FILE = 'history.json'

def load_history():
    if os.path.exists(HISTORY_FILE):
        try:
            with open(HISTORY_FILE, 'r') as f:
                return json.load(f)
        except Exception:
            return []
    return []

def save_history(history):
    with open(HISTORY_FILE, 'w') as f:
        json.dump(history, f, indent=4)

@app.after_request
def add_cors_headers(response):
    response.headers['Access-Control-Allow-Origin'] = '*'
    response.headers['Access-Control-Allow-Headers'] = 'Content-Type'
    response.headers['Access-Control-Allow-Methods'] = 'POST, GET, OPTIONS'
    return response

@app.route('/')
def index():
    # Render main template
    return render_template('index.html')

@app.route('/widget')
def widget():
    # Render chat widget test page
    return render_template('widget.html')

@app.route('/demo')
def demo():
    # Render the standalone dummy website with embedded chat widget
    return render_template('demo.html')

@app.route('/api/companies', methods=['GET'])
def get_companies():
    companies = chatbot_service.get_companies()
    return jsonify({'companies': companies})

@app.route('/api/faqs', methods=['GET'])
def get_faqs():
    company = request.args.get('company')
    all_faqs = chatbot_service.get_all_faqs()
    if company:
        filtered = [f for f in all_faqs if f['company'].lower() == company.lower()]
        return jsonify({'faqs': filtered})
    return jsonify({'faqs': all_faqs})

@app.route('/api/faqs', methods=['POST'])
def add_faq():
    data = request.get_json() or {}
    company = data.get('company')
    question = data.get('question')
    answer = data.get('answer')
    
    if not company or not question or not answer:
        return jsonify({'error': 'Missing company, question, or answer'}), 400
        
    chatbot_service.add_faq(company, question, answer)
    return jsonify({'message': 'FAQ added successfully', 'faqs': chatbot_service.get_all_faqs()})

@app.route('/api/faqs/<faq_id>', methods=['PUT'])
def update_faq(faq_id):
    data = request.get_json() or {}
    company = data.get('company')
    question = data.get('question')
    answer = data.get('answer')
    
    if not company or not question or not answer:
        return jsonify({'error': 'Missing company, question, or answer'}), 400
        
    success = chatbot_service.update_faq(faq_id, company, question, answer)
    if not success:
        return jsonify({'error': 'FAQ not found'}), 404
        
    return jsonify({'message': 'FAQ updated successfully', 'faqs': chatbot_service.get_all_faqs()})

@app.route('/api/faqs/<faq_id>', methods=['DELETE'])
def delete_faq(faq_id):
    success = chatbot_service.delete_faq(faq_id)
    if not success:
        return jsonify({'error': 'FAQ not found'}), 404
        
    return jsonify({'message': 'FAQ deleted successfully', 'faqs': chatbot_service.get_all_faqs()})

@app.route('/api/chat', methods=['POST'])
@app.route('/chat', methods=['POST'])
def chat():
    data = request.get_json() or {}
    company = data.get('company')
    question = data.get('question')
    threshold = data.get('threshold', 0.6)
    
    if not company or not question:
        return jsonify({'error': 'Missing company or question'}), 400
        
    # Check if company exists
    available = chatbot_service.get_companies()
    if company not in available:
        return jsonify({
            'error': f'Company "{company}" not found',
            'available_companies': available
        }), 404
        
    # Configure company context for chatbot
    chatbot_service.set_company(company)
    
    # Process response
    response_data = chatbot_service.get_response(question, threshold=threshold)
    
    # Log query history
    history = load_history()
    log_entry = {
        'timestamp': datetime.datetime.now().isoformat(),
        'company': company,
        'question': question,
        'matched_question': response_data['matched_question'],
        'answer': response_data['answer'],
        'score': round(response_data.get('score', response_data.get('confidence', 0.0)), 4),
        'fallback': response_data.get('fallback', response_data['answer'].startswith("I'm sorry, I don't have"))
    }
    history.append(log_entry)
    save_history(history)
    
    # Return formatted response containing both score/confidence for compatibility
    return jsonify({
        'answer': response_data['answer'],
        'matched_question': response_data['matched_question'],
        'score': round(response_data.get('score', response_data.get('confidence', 0.0)), 4),
        'confidence': round(response_data.get('confidence', response_data.get('score', 0.0)), 4),
        'fallback': log_entry['fallback']
    })

@app.route('/api/history', methods=['GET'])
def get_history():
    return jsonify({'history': load_history()})

@app.route('/api/history/clear', methods=['POST'])
def clear_history():
    save_history([])
    return jsonify({'message': 'History cleared successfully'})

@app.route('/api/stats', methods=['GET'])
def get_stats():
    history = load_history()
    faqs = chatbot_service.get_all_faqs()
    
    total_queries = len(history)
    scores = [h['score'] for h in history if not h.get('fallback', False) or h['score'] > 0]
    avg_score = sum(scores) / len(scores) if scores else 0.0
    
    low_confidence_queries = sum(1 for h in history if h.get('fallback', True))
    
    # Compute counts per company
    company_counts = {}
    for h in history:
        c = h['company']
        company_counts[c] = company_counts.get(c, 0) + 1
        
    return jsonify({
        'total_queries': total_queries,
        'avg_confidence': round(avg_score, 4),
        'low_confidence_count': low_confidence_queries,
        'total_faqs': len(faqs),
        'company_queries': company_counts
    })

if __name__ == '__main__':
    app.run(debug=True, port=5000)
