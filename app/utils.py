import unicodedata
import re

# 특수 케이스
_ALIASES: dict[str, str] = {
    'ACTØ': 'ACT0',
    'CODE:Ø': 'CODE:0',
    'ÆTHER': 'ATHER',
    'BLO§OM': 'BLOSSOM',
    '火影': '焱影',
    "POLꓘAMAИIA": "POLꞰAMAИIA",
}

# NFKD로 분해되지 않는 유사자 치환 테이블
_TRANS = str.maketrans({
    '¡': '!', # 역 느낌표
    'Ø': 'O', 'ø': 'o', # O with stroke (Ø, ø)
    'Ʞ': 'K', # 뒤집힌 K
    'æ': 'ae', 'Æ': 'AE', # ae 합자
    'Λ': 'A', '∧': 'A', # 그리스 람다 / 논리곱
    'ə': 'e', # 슈와 (uən → uen)
    'Χ': 'X', 'χ': 'x', # 그리스 Chi (Χ-DEN → X-DEN)
    'ƒ': 'f', # ƒƒƒƒƒ → fffff
    '<': '', '>': '',
    # 'И': 'N', # 키릴 И (Zenith, ZEИITH 구분을 위해 주석처리)
})


def normalize_title(title: str) -> str:
    # 1. 예외 처리
    title = _ALIASES.get(title, title)
    # 2. 유사자 치환
    title = title.translate(_TRANS)
    # 3. NFKD: 전각→반각 + 악센트 분해 (ö → o + 결합문자)
    title = unicodedata.normalize('NFKD', title)
    # 4. 결합 문자(악센트 등) 제거
    title = ''.join(c for c in title if unicodedata.category(c) != 'Mn')
    # 5. 소문자화
    title = title.lower()
    # 6. 공백, 기호, 특문 등 제거
    title = re.sub(
        r"[\s\-_.'\u2019\"\u201c\u201d()~\u301c\uff5e\u2661\u2665"
        r"\u266a\u266b\u266c"   # ♪♫♬
        r"\u300a\u300b"         # 《》
        r"\u30fb\u00b7"         # ・ (가타카나 중점), · (중간점)
        r"\u2668"               # ♨
        r"\u200b\ufeff"         # 제로 너비 공백
        r"!]",
        '', title
    )
    return title