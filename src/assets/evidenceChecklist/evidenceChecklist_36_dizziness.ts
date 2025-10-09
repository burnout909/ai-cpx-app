export interface EvidenceChecklist {
  id: string;
  title: string;
  criteria: string;
}

export const HistoryEvidenceChecklist: EvidenceChecklist[] = [
  {
    "id": "HX-01",
    "title": "실신이나 두통 감별",
    "criteria": "쓰러진 후 기억 나지 않음(실신), 두통, 술먹고 어지러운 거 아닌지 등 2가지 이상 질문하였는가?"
  },
  {
    "id": "HX-02",
    "title": "어지럼증의 시간에 따른 특성",
    "criteria": "시작기간, 지속기간(1~2분은 BPPV, 10분은 뇌허혈, 2~3시간은 안뜰신경염-메니에르병), 이전에도 있는지 등 시간 관련 2가지 이상 질문하였는가?"
  },
  {
    "id": "HX-03",
    "title": "어지럼증의 양상",
    "criteria": "본인 혹은 주변이 빙빙 도는지 등 2가지 이상 질문하였는가?"
  },
  {
    "id": "HX-04",
    "title": "어지럼증의 강도",
    "criteria": "얼마나 심하게 어지러운지, 일상생활에 지장이 있는지 등 1가지 이상 질문하였는가?"
  },
  {
    "id": "HX-05",
    "title": "어지럼증이 심해지는 자세나 상황",
    "criteria": "앉았다 일어났다(기립성 저혈압), 누웠다가 일어날 때(BPPV) 등 2가지 이상 질문하였는가?"
  },
  {
    "id": "HX-06",
    "title": "어지럼증이 완화되는 자세나 상황",
    "criteria": "눈을 감거나 떴을 때 등 1가지 이상 질문하였는가?"
  },
  {
    "id": "HX-07",
    "title": "동반되는 안이비인후과적 증상",
    "criteria": "귀 물찬 느낌, 청력 저하, 이명 등 2가지 이상 질문하였는가?"
  },
  {
    "id": "HX-08",
    "title": "동반되는 신경학적 증상",
    "criteria": "손떨림이나 뻣뻣함(파킨슨병), 힘빠짐(뇌혈관) 등 2가지 이상 질문하였는가?"
  },
  {
    "id": "HX-09",
    "title": "동반되는 간접적인 전신 증상",
    "criteria": "두통(편두통), 구토, 혈변(빈혈) 등 2가지 이상 질문하였는가?"
  },
  {
    "id": "HX-10",
    "title": "과거력",
    "criteria": "고혈압, 당뇨병, 뇌혈관 질환, 편두통 등 2가지 이상 질문하였는가?"
  },
  {
    "id": "HX-11",
    "title": "약물 복용력",
    "criteria": "정신건강의학과 약물 유무, 얼마나 오랫동안 복용해왔는지 1가지 이상 질문하였는가?"
  },
  {
    "id": "HX-12",
    "title": "직업력과 사회력",
    "criteria": "직업, 식습관, 술, 담배, 건강기능식품, 운동 등 2가지 이상 질문하였는가?"
  },
  {
    "id": "HX-13",
    "title": "가족력",
    "criteria": "혈압, 당뇨병, 뇌혈관 질환, 편두통 등 1가지 이상 질문하였는가?"
  },
  {
    "id": "HX-14",
    "title": "외상여부 및 수술/골절 입원력",
    "criteria": "뇌수술 유무, 두부골절, 입원 유무 1가지 이상 질문하였는가?"
  },
  {
    "id": "HX-15",
    "title": "[여성] 월경 양상",
    "criteria": "생리량, 임신 가능성 등 1가지 이상 질문하였는가?"
  },
  {
    "id": "HX-16",
    "title": "[정신] 정신건강의학적 원인이나 과거력",
    "criteria": "공황장애, 불안장애, 과호흡 증후군 등 1가지 이상 질문하였는가?"
  },
  {
    "id": "HX-17",
    "title": "동반되는 정신과적 증상",
    "criteria": "우울, 불안 등 1가지 이상 질문하였는가?"
  }
];

export const PhysicalexamEvidenceChecklist: EvidenceChecklist[] = [
  {
    "id": "PE-01",
    "title": "눈 운동 및 Head shaking test",
    "criteria": "안진의 양상과 방향성 확인, 좌우로 흔들고 정면 주시하는 검사를 시행하였는가?"
  },
  {
    "id": "PE-02",
    "title": "결막, 구강, 혀 확인",
    "criteria": "결막이 창백한지(빈혈), 구강(출혈, 탈수), 혀를 깨문 흔적(경련)을 확인하였는가?"
  },
  {
    "id": "PE-03",
    "title": "두경부 확인",
    "criteria": "머리를 시진, 촉진하였는가?"
  },
  {
    "id": "PE-04",
    "title": "뇌압 상승여부 확인",
    "criteria": "검안경으로 시신경 유두 부종 확인 또는 meningeal irritating sign을 확인하였는가?"
  },
  {
    "id": "PE-05",
    "title": "뇌 신경검사",
    "criteria": "뇌신경검사 2번-3번-5번-7번-8번을 포함한 4항목 이상 시행하였는가?"
  },
  {
    "id": "PE-06",
    "title": "소뇌기능 검사",
    "criteria": "finger to nose, alternating hand movement, heel to shin, Romberg, 일자걸음검사 중 3항목 이상 시행하였는가?"
  },
  {
    "id": "PE-07",
    "title": "기타 신경학적 검사",
    "criteria": "팔다리근력-감각-DTR-병적반사 중 3항목 이상 시행하였는가?"
  },
  {
    "id": "PE-08",
    "title": "특정자세유발검사",
    "criteria": "Dix-Hallpike검사(머리를 낮게 유지, 검사자와 눈 마주침) 또는 Rolling 검사를 시행하였는가?"
  }
];

export const EducationEvidenceChecklist: EvidenceChecklist[] = [
  {
    "id": "ED-01",
    "title": "다양한 원인 또는 질환 설명",
    "criteria": "예상되는 원인 또는 병명에 대해 1가지 이상 설명하였는가?"
  },
  {
    "id": "ED-02",
    "title": "향후 검사 설명",
    "criteria": "질환별 검사 2가지 이상 설명하였는가?"
  },
  {
    "id": "ED-03",
    "title": "위험성 줄이는 방법 교육",
    "criteria": "저염식이(메니에르), 전정재활훈련(전정기관 원인) 등 2가지 이상 교육하였는가?"
  },
  {
    "id": "ED-04",
    "title": "향후 치료 계획 설명",
    "criteria": "질환별 치료계획 2가지 이상 설명하였는가?"
  },
  {
    "id": "ED-05",
    "title": "재방문 시기나 입원 필요성 교육",
    "criteria": "팔 다리 힘 빠짐, 의식 소실 등 2가지 이상 교육하였는가?"
  }
];

export const PpiEvidenceChecklist: EvidenceChecklist[] = [
  {
    "id": "PPI-01",
    "title": "자기 소개",
    "criteria": "본인의 이름과 역할(학생의사 등)을 명확히 소개하였는가?"
  },
  {
    "id": "PPI-02",
    "title": "환자 확인",
    "criteria": "환자의 성함과 나이를 확인하였는가?"
  },
  {
    "id": "PPI-03",
    "title": "일상적 배려 대화",
    "criteria": "날씨, 병원까지 오시는 교통편 등 일상적 배려 표현을 하였는가?"
  },
  {
    "id": "PPI-04",
    "title": "공감 표현",
    "criteria": "'힘드셨겠네요', '제가 도와드리겠습니다' 등 진정성 있는 공감 표현을 하였는가?"
  },
  {
    "id": "PPI-05",
    "title": "중간 요약",
    "criteria": "'잠시 요약을 해보자면'이라고 명시하며 환자의 병력을 3~4가지 특징으로 중간 요약하였는가?"
  },
  {
    "id": "PPI-06",
    "title": "신체진찰 설명 및 동의",
    "criteria": "신체 진찰 전 진찰 내용을 설명하고 동의를 구하였는가?"
  },
  {
    "id": "PPI-07",
    "title": "신체진찰 후 환자 배려",
    "criteria": "신체 진찰 후 '옷 정리하셔도 됩니다', '자리로 가서 앉아주시면 됩니다' 등 안내하였는가?"
  },
  {
    "id": "PPI-08",
    "title": "환자 입장 파악",
    "criteria": "'혹시 걱정되시는 것이 있으신가요?' 등 환자의 관점과 걱정을 파악하였는가?"
  },
  {
    "id": "PPI-09",
    "title": "이해하기 쉬운 설명",
    "criteria": "비전문 용어로 핵심을 설명하고 과도한 의학 용어 사용을 자제하였는가?"
  },
  {
    "id": "PPI-10",
    "title": "이해도 확인",
    "criteria": "'지금까지 이해 안 되는 것 있나요?' 등으로 환자의 이해도를 확인하였는가?"
  },
  {
    "id": "PPI-11",
    "title": "질문 기회 제공",
    "criteria": "'궁금한 것 있으신가요?' 등으로 환자에게 질문할 기회를 명확히 제공하였는가?"
  }
];
