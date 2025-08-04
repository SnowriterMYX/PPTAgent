"""
PPTAgent调试工具模块
用于监控和诊断段落ID相关问题
"""

import json
import logging
from typing import Dict, List, Any, Optional
from dataclasses import dataclass, asdict
from datetime import datetime

from pptagent.presentation import SlidePage
from pptagent.utils import get_logger

logger = get_logger(__name__)


@dataclass
class ParagraphIDIssue:
    """段落ID问题记录"""
    timestamp: str
    slide_idx: int
    element_id: int
    requested_id: int
    available_ids: List[int]
    operation: str
    corrected_id: Optional[int] = None
    error_message: str = ""
    
    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)


class ParagraphIDMonitor:
    """段落ID监控器"""
    
    def __init__(self):
        self.issues: List[ParagraphIDIssue] = []
        self.statistics = {
            'auto_corrected_operations': 0,
            'failed_operations': 0,
            'most_common_issues': {}
        }
    
    def record_issue(self, 
                    slide_idx: int,
                    element_id: int, 
                    requested_id: int,
                    available_ids: List[int],
                    operation: str,
                    corrected_id: Optional[int] = None,
                    error_message: str = ""):
        """记录段落ID问题"""
        issue = ParagraphIDIssue(
            timestamp=datetime.now().isoformat(),
            slide_idx=slide_idx,
            element_id=element_id,
            requested_id=requested_id,
            available_ids=available_ids.copy(),
            operation=operation,
            corrected_id=corrected_id,
            error_message=error_message
        )
        
        self.issues.append(issue)
        self._update_statistics(issue)
        
        logger.warning(f"Paragraph ID issue recorded: {issue}")
    
    def _update_statistics(self, issue: ParagraphIDIssue):
        """更新统计信息 - 只统计问题，不统计成功操作"""
        # 只有真正的问题才会被记录，所以这里只统计问题类型
        if issue.corrected_id is not None:
            self.statistics['auto_corrected_operations'] += 1
        elif issue.error_message:
            self.statistics['failed_operations'] += 1
        
        # 记录常见问题模式
        issue_pattern = f"requested_{issue.requested_id}_available_{max(issue.available_ids) if issue.available_ids else 'none'}"
        if issue_pattern not in self.statistics['most_common_issues']:
            self.statistics['most_common_issues'][issue_pattern] = 0
        self.statistics['most_common_issues'][issue_pattern] += 1
    
    def get_report(self) -> Dict[str, Any]:
        """生成监控报告"""
        return {
            'summary': self.statistics,
            'recent_issues': [issue.to_dict() for issue in self.issues[-10:]],
            'total_issues': len(self.issues),
            'recommendations': self._generate_recommendations()
        }
    
    def _generate_recommendations(self) -> List[str]:
        """生成改进建议"""
        recommendations = []

        if self.statistics['auto_corrected_operations'] > 0:
            recommendations.append(
                f"检测到{self.statistics['auto_corrected_operations']}次段落ID自动修正，建议检查AI模型的段落ID计算逻辑"
            )

        if self.statistics['failed_operations'] > 0:
            recommendations.append(
                f"检测到{self.statistics['failed_operations']}次操作失败，建议优化段落ID验证机制"
            )

        # 分析常见问题模式
        common_issues = self.statistics['most_common_issues']
        if common_issues:
            most_common = max(common_issues.items(), key=lambda x: x[1])
            recommendations.append(
                f"最常见的问题模式: {most_common[0]}，出现{most_common[1]}次"
            )

        if not self.issues:
            recommendations.append("未检测到段落ID相关问题")

        return recommendations
    
    def export_to_file(self, filepath: str):
        """导出监控数据到文件"""
        report = self.get_report()
        with open(filepath, 'w', encoding='utf-8') as f:
            json.dump(report, f, ensure_ascii=False, indent=2)
        
        logger.info(f"Paragraph ID monitoring report exported to {filepath}")


class SlideStructureAnalyzer:
    """幻灯片结构分析器"""
    
    @staticmethod
    def analyze_slide_structure(slide: SlidePage) -> Dict[str, Any]:
        """分析幻灯片的段落结构"""
        structure = {
            'slide_idx': slide.slide_idx,
            'elements': [],
            'total_paragraphs': 0,
            'issues': []
        }
        
        for shape_idx, shape in enumerate(slide.shapes):
            if not hasattr(shape, 'text_frame') or not shape.text_frame.is_textframe:
                continue
            
            element_info = {
                'element_id': shape_idx,
                'paragraphs': [],
                'valid_paragraph_count': 0,
                'invalid_paragraph_count': 0
            }
            
            for para in shape.text_frame.paragraphs:
                para_info = {
                    'idx': para.idx,
                    'real_idx': para.real_idx,
                    'text_preview': para.text[:50] + '...' if len(para.text) > 50 else para.text,
                    'is_valid': para.idx != -1
                }
                
                element_info['paragraphs'].append(para_info)
                
                if para.idx != -1:
                    element_info['valid_paragraph_count'] += 1
                    structure['total_paragraphs'] += 1
                else:
                    element_info['invalid_paragraph_count'] += 1
            
            # 检查段落ID连续性
            valid_ids = [p['idx'] for p in element_info['paragraphs'] if p['is_valid']]
            if valid_ids:
                expected_ids = list(range(len(valid_ids)))
                if valid_ids != expected_ids:
                    structure['issues'].append({
                        'element_id': shape_idx,
                        'issue_type': 'non_consecutive_ids',
                        'expected': expected_ids,
                        'actual': valid_ids
                    })
            
            structure['elements'].append(element_info)
        
        return structure
    
    @staticmethod
    def generate_structure_report(slide: SlidePage) -> str:
        """生成可读的结构报告"""
        analysis = SlideStructureAnalyzer.analyze_slide_structure(slide)
        
        report = f"=== 幻灯片 {analysis['slide_idx']} 结构分析 ===\n"
        report += f"总段落数: {analysis['total_paragraphs']}\n"
        report += f"元素数量: {len(analysis['elements'])}\n\n"
        
        for element in analysis['elements']:
            report += f"元素 {element['element_id']}:\n"
            report += f"  有效段落: {element['valid_paragraph_count']}\n"
            report += f"  无效段落: {element['invalid_paragraph_count']}\n"
            
            if element['paragraphs']:
                report += "  段落详情:\n"
                for para in element['paragraphs']:
                    status = "✓" if para['is_valid'] else "✗"
                    report += f"    {status} ID:{para['idx']} (real:{para['real_idx']}) - {para['text_preview']}\n"
            
            report += "\n"
        
        if analysis['issues']:
            report += "发现的问题:\n"
            for issue in analysis['issues']:
                report += f"  - 元素 {issue['element_id']}: {issue['issue_type']}\n"
                report += f"    期望ID: {issue['expected']}\n"
                report += f"    实际ID: {issue['actual']}\n"
        
        return report


# 全局监控器实例
paragraph_monitor = ParagraphIDMonitor()


def get_paragraph_monitor() -> ParagraphIDMonitor:
    """获取全局段落ID监控器"""
    return paragraph_monitor


def debug_slide_structure(slide: SlidePage) -> str:
    """调试幻灯片结构的便捷函数"""
    return SlideStructureAnalyzer.generate_structure_report(slide)
