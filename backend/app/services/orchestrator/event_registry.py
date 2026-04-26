from typing import Dict, Any, List

# Event type definitions for dynamic forms and title generation
EVENT_TYPES = {
    "poi_closed": {
        "label": "景点临时闭馆",
        "fields": [
            {"name": "poi_id", "label": "景点 ID", "type": "string", "required": True},
            {"name": "poi_name", "label": "景点名称", "type": "string", "required": True},
            {"name": "reason", "label": "原因", "type": "string", "placeholder": "如：临时维修、天气原因"}
        ],
        "title_tpl": "{poi_name} 临时闭馆"
    },
    "member_drop": {
        "label": "成员临时退出",
        "fields": [
            {"name": "user_id", "label": "成员 ID", "type": "string", "required": True},
            {"name": "user_name", "label": "成员姓名", "type": "string", "required": True},
            {"name": "reason", "label": "原因", "type": "string", "placeholder": "如：生病、临时有事"}
        ],
        "title_tpl": "{user_name} 因{reason}退出行程"
    },
    "schedule_shift": {
        "label": "行程整体顺延",
        "fields": [
            {"name": "delay_minutes", "label": "顺延分钟数", "type": "number", "required": True, "default": 60},
            {"name": "reason", "label": "原因", "type": "string"}
        ],
        "title_tpl": "行程整体顺延 {delay_minutes} 分钟"
    },
    "custom": {
        "label": "自定义事件",
        "fields": [
            {"name": "description", "label": "事件描述", "type": "string", "required": True, "placeholder": "描述发生的突发情况"}
        ],
        "title_tpl": "{description}"
    }
}

def get_event_types_schema():
    return EVENT_TYPES

def format_event_title(event_type: str, params: Dict[str, Any]) -> str:
    tpl = EVENT_TYPES.get(event_type, {}).get("title_tpl", "突发事件")
    try:
        return tpl.format(**params)
    except KeyError:
        return tpl
