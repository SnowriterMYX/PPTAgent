#!/usr/bin/env python3
"""
检查文件编码
"""

import chardet
import os

def check_file_encoding(file_path):
    """检查文件编码"""
    try:
        with open(file_path, 'rb') as f:
            raw_data = f.read()
            result = chardet.detect(raw_data)
            print(f"文件: {file_path}")
            print(f"检测到的编码: {result['encoding']}")
            print(f"置信度: {result['confidence']:.2f}")
            
            # 尝试用不同编码读取
            encodings_to_try = ['utf-8', 'gbk', 'gb2312', 'utf-16']
            
            for encoding in encodings_to_try:
                try:
                    with open(file_path, 'r', encoding=encoding) as f:
                        content = f.read()
                        print(f"✅ {encoding}: 成功读取 ({len(content)} 字符)")
                        if encoding == 'utf-8':
                            print(f"内容预览: {content[:100]}...")
                        break
                except UnicodeDecodeError as e:
                    print(f"❌ {encoding}: {e}")
                except Exception as e:
                    print(f"❌ {encoding}: {e}")
            
            return result
            
    except Exception as e:
        print(f"检查文件编码失败: {e}")
        return None

def fix_file_encoding(file_path):
    """修复文件编码为UTF-8"""
    try:
        # 先检测当前编码
        with open(file_path, 'rb') as f:
            raw_data = f.read()
            result = chardet.detect(raw_data)
            detected_encoding = result['encoding']
        
        if detected_encoding and detected_encoding.lower() != 'utf-8':
            print(f"正在将文件从 {detected_encoding} 转换为 UTF-8...")
            
            # 用检测到的编码读取
            with open(file_path, 'r', encoding=detected_encoding) as f:
                content = f.read()
            
            # 用UTF-8写回
            with open(file_path, 'w', encoding='utf-8') as f:
                f.write(content)
            
            print(f"✅ 文件编码已转换为 UTF-8")
            return True
        else:
            print(f"文件已经是 UTF-8 编码")
            return True
            
    except Exception as e:
        print(f"修复文件编码失败: {e}")
        return False

if __name__ == "__main__":
    caption_file = "pptagent/prompts/caption.txt"
    
    print("🔍 检查 caption.txt 文件编码...")
    result = check_file_encoding(caption_file)
    
    if result and result['encoding'] and result['encoding'].lower() != 'utf-8':
        print(f"\n🔧 需要修复编码...")
        if fix_file_encoding(caption_file):
            print("✅ 编码修复完成")
        else:
            print("❌ 编码修复失败")
    else:
        print("✅ 文件编码正常")
