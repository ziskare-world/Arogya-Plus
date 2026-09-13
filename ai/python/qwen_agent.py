"""
🤖 ArogyaPlus - Hugging Face Transformers Qwen AI Agent Runner
Uses AutoTokenizer and AutoModelForCausalLM for Qwen3-30B-A3B model inference.
"""

import sys
import json
import os

def run_qwen_agent():
    raw_input = sys.stdin.read().strip()
    messages = [
        {"role": "user", "content": "Who are you?"}
    ]

    max_new_tokens = 60

    if raw_input:
        try:
            parsed = json.loads(raw_input)
            if isinstance(parsed, list):
                messages = parsed
            elif isinstance(parsed, dict) and "messages" in parsed:
                messages = parsed["messages"]
                if "max_new_tokens" in parsed:
                    max_new_tokens = int(parsed["max_new_tokens"])
        except Exception as e:
            sys.stderr.write(f"Warning: Failed to parse input JSON: {e}\n")

    try:
        from transformers import AutoTokenizer, AutoModelForCausalLM
        import torch

        model_name = os.environ.get("QWEN_MODEL_NAME", "Qwen/Qwen3-30B-A3B")

        tokenizer = AutoTokenizer.from_pretrained(model_name)
        model = AutoModelForCausalLM.from_pretrained(model_name, device_map="auto")

        inputs = tokenizer.apply_chat_template(
            messages,
            add_generation_prompt=True,
            tokenize=True,
            return_dict=True,
            return_tensors="pt"
        ).to(model.device)

        outputs = model.generate(**inputs, max_new_tokens=max_new_tokens)
        response_text = tokenizer.decode(outputs[0][inputs["input_ids"].shape[-1]:], skip_special_tokens=True)
        
        output_payload = {
            "success": True,
            "model": model_name,
            "response": response_text.strip()
        }
        print(json.dumps(output_payload))

    except Exception as err:
        error_payload = {
            "success": False,
            "error": str(err),
            "fallback_response": "I am Arogya AI, an intelligent clinical healthcare assistant powered by Hugging Face Transformers. How may I assist your medical care or health management today?"
        }
        print(json.dumps(error_payload))

if __name__ == "__main__":
    run_qwen_agent()
