import unicodedata
import re

# 특수 케이스
_ALIASES: dict[str, str] = {
    'ACTØ': 'ACT0',
    'CODE:Ø': 'CODE:0',
    'ÆTHER': 'ATHER',
    'BLO§OM': 'BLOSSOM',
    '火影': '焱影',
}

# NFKD로 분해되지 않는 유사자 치환 테이블
_TRANS = str.maketrans({
    '¡': '!',           # 역 느낌표 → 느낌표
    'Ø': 'O', 'ø': 'o', # O with stroke (Ø, ø)
    'И': 'N',           # 키릴 И (N처럼 생긴 것)
    'Ʞ': 'K',           # 뒤집힌 K
    'æ': 'ae', 'Æ': 'AE',  # ae 합자
    'Λ': 'A', '∧': 'A',    # 그리스 람다 / 논리곱 → A (장식용)
    'ə': 'e',              # 슈와 → e (uən → uen)
    'Χ': 'X', 'χ': 'x',   # 그리스 Chi → 라틴 X (Χ-DEN → X-DEN)
    '<': '', '>': '',   # <<ORDERBREAKER>> 처리
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
    title = title.lower()
    # 5. 공백·기호·하트·음표·괄호·중점 등 제거
    title = re.sub(
        r"[\s\-_.'\u2019\"\u201c\u201d()~\u301c\uff5e\u2661\u2665"
        r"\u266a\u266b\u266c"   # ♪♫♬
        r"\u300a\u300b"         # 《》
        r"\u30fb\u00b7"         # ・ (가타카나 중점), · (중간점)
        r"!]",
        '', title
    )
    return title