import json
import logging
import random
from typing import Optional

from openai import AsyncOpenAI

from app.config import settings

logger = logging.getLogger(__name__)

DOMAIN_POOL = [
    {
        "name": "编程与计算机科学",
        "icon": "Code2",
        "color": "accent-info",
        "description": "Software engineering, algorithms, data structures, system design, DevOps, API development, machine learning",
    },
    {
        "name": "遥感与地球科学",
        "icon": "Satellite",
        "color": "emerald-400",
        "description": "SEBAL algorithm, evapotranspiration, land surface temperature (LST), NDVI/vegetation indices, satellite imagery, surface energy balance",
    },
    {
        "name": "医学与生物学",
        "icon": "Heart",
        "color": "red-400",
        "description": "Clinical diagnosis, anatomy, pharmacology, genetic engineering, epidemiology, medical imaging",
    },
    {
        "name": "金融与经济学",
        "icon": "TrendingUp",
        "color": "amber-400",
        "description": "Financial markets, quantitative analysis, blockchain, risk management, economic modeling, fintech",
    },
    {
        "name": "物理与工程学",
        "icon": "Zap",
        "color": "purple-400",
        "description": "Quantum mechanics, thermodynamics, electrical engineering, aerospace, structural mechanics, optics",
    },
    {
        "name": "人工智能与数据科学",
        "icon": "Brain",
        "color": "pink-400",
        "description": "Neural networks, NLP, computer vision, data mining, statistical learning, reinforcement learning",
    },
    {
        "name": "人文与社会科学",
        "icon": "BookOpen",
        "color": "indigo-400",
        "description": "Philosophy, psychology, linguistics, sociology, history, literature, education theory",
    },
    {
        "name": "日常生活",
        "icon": "Coffee",
        "color": "orange-400",
        "description": "Daily conversation, travel, food, culture, entertainment, social interaction, hobbies",
    },
]


def _pick_domains() -> list[dict]:
    picked = random.sample(DOMAIN_POOL, min(2, len(DOMAIN_POOL)))
    return picked


def _build_system_prompt(domains: list[dict]) -> str:
    domain_descriptions = []
    for i, d in enumerate(domains):
        domain_descriptions.append(f"{i + 1}. **{d['name']}**: {d['description']}.")

    domain_names = " and ".join([f"'{d['name']}'" for d in domains])

    return f"""You are an expert language tutor for TZYNB, a scientific vocabulary learning platform. \
Your role is to create memorable, domain-specific context sentences that help learners deeply understand and retain words.

Today's selected domains are {domain_names}.

Domain expertise:
{chr(10).join(domain_descriptions)}

Rules:
- Each sentence must include the target word in **bold** (using markdown **word**).
- {domains[0]['name']} example: 15-25 words, demonstrate the word in a real {domains[0]['name']} context.
- {domains[1]['name']} example: 15-25 words, demonstrate the word in a real {domains[1]['name']} context.
- Translation: Provide a concise Chinese translation of the first example.
- Be scientifically accurate. Use proper terminology.
- Make sentences vivid and memorable.

Output format (strict JSON):
{{
  "domain_0_example": "A sentence using **word** in a {domains[0]['name']} context.",
  "domain_1_example": "A sentence using **word** in a {domains[1]['name']} context.",
  "domain_0_name": "{domains[0]['name']}",
  "domain_1_name": "{domains[1]['name']}",
  "translation": "中文翻译"
}}"""


def _get_api_key(user_api_key: Optional[str] = None) -> Optional[str]:
    return user_api_key or settings.OPENAI_API_KEY


async def generate_context(word: str, definition: str, api_key: Optional[str] = None) -> dict:
    key = _get_api_key(api_key)
    if not key:
        return _get_fallback_context(word, definition)

    domains = _pick_domains()

    try:
        client = AsyncOpenAI(api_key=key)
        response = await client.chat.completions.create(
            model=settings.OPENAI_MODEL,
            messages=[
                {"role": "system", "content": _build_system_prompt(domains)},
                {
                    "role": "user",
                    "content": (
                        f"Create two context sentences for the word '{word}' (meaning: {definition}).\n"
                        f"1. {domains[0]['name']} context\n"
                        f"2. {domains[1]['name']} context\n"
                        "Also provide a Chinese translation of the first example."
                    ),
                },
            ],
            response_format={"type": "json_object"},
            temperature=0.8,
            max_tokens=250,
        )
        content = response.choices[0].message.content
        if content:
            result = json.loads(content)
            if "domain_0_example" in result and "domain_1_example" in result:
                return {
                    "domain_0_example": result["domain_0_example"],
                    "domain_1_example": result["domain_1_example"],
                    "domain_0_name": result.get("domain_0_name", domains[0]["name"]),
                    "domain_1_name": result.get("domain_1_name", domains[1]["name"]),
                    "translation": result.get("translation", ""),
                    "domain_0_color": domains[0]["color"],
                    "domain_1_color": domains[1]["color"],
                }
    except Exception as e:
        logger.warning(f"AI context generation failed for '{word}': {e}")

    return _get_fallback_context(word, definition)


def _get_fallback_context(word: str, definition: str) -> dict:
    return {
        "domain_0_example": "",
        "domain_1_example": "",
        "domain_0_name": "",
        "domain_1_name": "",
        "translation": "",
        "domain_0_color": "surface-500",
        "domain_1_color": "surface-500",
    }


async def generate_batch_contexts(word_def_pairs: list[tuple[str, str]]) -> list[dict]:
    contexts = []
    for word, definition in word_def_pairs:
        ctx = await generate_context(word, definition)
        contexts.append(ctx)
    return contexts
