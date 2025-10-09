export interface EvidenceChecklist {
  id: string;
  title: string;
  criteria: string;
}

export const HistoryEvidenceChecklist: EvidenceChecklist[] = [
  {
    "id": "HX-01",
    "title": "[윗배] 가슴통증, 소화불량 감별",
    "criteria": "가슴통증이나 소화불량을 감별하였는가?"
  },
  {
    "id": "HX-02",
    "title": "통증 위치 문진",
    "criteria": "통증 위치를 짚어보게 하는 등 위치 관련 질문을 하였는가?"
  },
  {
    "id": "HX-03",
    "title": "통증 시간적 특성",
    "criteria": "통증의 기간, 지속 여부, 주기성, 과거 발생 여부 등을 물어보았는가?"
  },
  {
    "id": "HX-04",
    "title": "통증 양상",
    "criteria": "쥐어짜는 듯, 콕콕 쑤시는 듯, 박동성 등 통증 양상에 대해 질문하였는가?"
  },
  {
    "id": "HX-05",
    "title": "방사통 확인",
    "criteria": "어깨나 등으로 퍼지는 통증 여부를 확인하였는가?"
  },
  {
    "id": "HX-06",
    "title": "통증 정도와 일상생활 지장",
    "criteria": "통증의 강도(VAS 점수)나 일상생활 지장 여부를 확인하였는가?"
  },
  {
    "id": "HX-07",
    "title": "악화 요인 확인",
    "criteria": "기침, 배를 쭉 피는 등 자세 변화, 지방 식이(췌장염 예상) 등 통증을 악화시키는 요인을 물어보았는가?"
  },
  {
    "id": "HX-08",
    "title": "전신 증상 확인",
    "criteria": "발열, 오한, 체중 변화, 피로감 등 전신 증상을 확인하였는가?"
  },
  {
    "id": "HX-09",
    "title": "간접 동반 증상 확인",
    "criteria": "식욕부진, 구역, 구토, 변비, 설사, 혈변, 황달 등 동반 증상을 물어보았는가?"
  },
  {
    "id": "HX-10",
    "title": "식습관/운동 확인",
    "criteria": "식습관이나 운동 여부를 질문하였는가?"
  },
  {
    "id": "HX-11",
    "title": "과거력 확인",
    "criteria": "소화기나 대사 관련 만성질환인 쓸개돌-담석-담도-담남염-이자염/대장암 등이 있는지 확인하였는가?"
  },
  {
    "id": "HX-12",
    "title": "약물 복용력",
    "criteria": "소염진통제, 소화제, 경구혈당강하제, 고혈압약, 항혈소판 제제(아스피린), 건강기능식품 등 복용 중인 약물 여부를 확인하였는가?"
  },
  {
    "id": "HX-13",
    "title": "직업력/사회력",
    "criteria": "직업, 식습관(날 것-상한것), 술, 담배, 건강기능식품, 운동 등 사회력을 확인하였는가?"
  },
  {
    "id": "HX-14",
    "title": "가족력",
    "criteria": "쓸개돌, 담석, 담도-담남염, 이자염, 대장암 등 가족의 소화기 관련 질환 여부를 확인하였는가?"
  },
  {
    "id": "HX-15",
    "title": "외상/수술/입원력",
    "criteria": "수술 유무, 골절, 입원 유무를 확인하였는가?"
  },
  {
    "id": "HX-16",
    "title": "[여성] 월경 양상",
    "criteria": "여성의 경우 생리량, 임신 가능성 등에 대해 물어보았는가?"
  }
];

export const PhysicalexamEvidenceChecklist: EvidenceChecklist[] = [
  {
    "id": "PE-01",
    "title": "눈 진찰",
    "criteria": "눈을 진찰하여 황달이나 빈혈 여부를 확인하였는가? (위로 쳐다보게 한 뒤 결막을 내려 확인)"
  },
  {
    "id": "PE-02",
    "title": "심장/폐 진찰",
    "criteria": "심장과 폐에 대해 시진과 청진을 시행하였는가? (상처·함몰·수포 확인, 심장음 4군데 청진, 6군데 촉진, 6군데 'ㄹ'자 타진, 청진 좌우 대칭 시행 포함)"
  },
  {
    "id": "PE-03",
    "title": "복부 진찰 자세",
    "criteria": "복부 진찰을 위해 환자를 바로 눕히고 양쪽 무릎을 세우게 하였는가?"
  },
  {
    "id": "PE-04",
    "title": "복부 진찰 순서",
    "criteria": "복부 진찰을 시진 → 청진 → 타진 → 촉진 순서로 시행하였는가?"
  },
  {
    "id": "PE-05",
    "title": "반발통 확인",
    "criteria": "통증이 심한 부위를 마지막으로 촉진하고 반발통 여부를 확인하였는가?"
  },
  {
    "id": "PE-06",
    "title": "간/비장 촉진",
    "criteria": "간과 비장을 촉진하였는가? (간: 양손을 Rt. costal margin에 대고 심호흡 시킴, 비장: 왼손을 Lt. flank에 두고 오른손으로 Lt. costal margin 아래를 눌러 확인)"
  },
  {
    "id": "PE-07",
    "title": "CVAT 확인",
    "criteria": "늑골척추각(CVAT) 압통 여부를 확인하였는가?"
  },
  {
    "id": "PE-08",
    "title": "충수돌기염 감별 검사",
    "criteria": "급성 충수돌기염 감별을 위한 이학적 검사를 시행하였는가? (예: Psoas sign, McBurney's point tenderness, Rovsing sign 중 2가지 이상)"
  },
  {
    "id": "PE-09",
    "title": "여성 환자 골반내진",
    "criteria": "여성이면서 아랫배 통증이 있는 경우 골반내진 검사를 시행하였는가?"
  }
];

export const EducationEvidenceChecklist: EvidenceChecklist[] = [
  {
    "id": "ED-01",
    "title": "가능한 원인/질환 설명",
    "criteria": "예상되는 원인이나 병명을 환자에게 설명하였는가?"
  },
  {
    "id": "ED-02",
    "title": "검사 필요성 설명",
    "criteria": "향후 시행할 검사나 확진 검사의 필요성을 설명하였는가?"
  },
  {
    "id": "ED-03",
    "title": "금식 안내",
    "criteria": "내시경 등의 검사가 필요한 경우 금식이 필요함을 안내하였는가?"
  },
  {
    "id": "ED-04",
    "title": "치료 계획 설명",
    "criteria": "향후 시행할 치료 계획(예: 금식 유지, 내시경 시술 등)을 설명하였는가?"
  },
  {
    "id": "ED-05",
    "title": "생활습관 교육",
    "criteria": "일상생활에서 위험성을 줄일 수 있는 방법(예: 운동, 식습관)을 교육하였는가?"
  },
  {
    "id": "ED-06",
    "title": "재방문/입원 필요성 안내",
    "criteria": "재방문 시기나 입원 필요성(예: 담낭염, 복막염, 장폐색 등 응급 수술 가능성)을 설명하였는가?"
  }
];

export const PpiEvidenceChecklist: EvidenceChecklist[] = [
  {
    "id": "PPI-01",
    "title": "배려와 예의",
    "criteria": "본인 소개, 역할 설명, 환자 성함/호칭 확인, 시선·자세·말속도 등 비언어적 배려를 하였는가?"
  },
  {
    "id": "PPI-02",
    "title": "공감적 경청 (NURSE)",
    "criteria": "환자의 말을 끊지 않고 공감 표현을 하였는가?"
  },
  {
    "id": "PPI-03",
    "title": "요약/반영 (paraphrase)",
    "criteria": "환자의 이야기를 중간에 요약하거나 반영하여 이해를 도왔는가?"
  },
  {
    "id": "PPI-04",
    "title": "이해하기 쉬운 설명",
    "criteria": "비전문 용어로 핵심을 설명하고 과도한 의학 용어 사용을 자제하였는가?"
  },
  {
    "id": "PPI-05",
    "title": "이해 확인",
    "criteria": "Teach-back을 활용하거나, 이해되지 않은 부분/궁금한 점이 있는지 확인하였는가?"
  }
];
