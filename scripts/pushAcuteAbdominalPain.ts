import { config } from "dotenv";
config({ path: ".env.local" });

import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";

const connectionString = process.env.DATABASE_URL || process.env.DIRECT_URL;
if (!connectionString) {
  throw new Error("DATABASE_URL or DIRECT_URL not found");
}

const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

// Scenario content from acute_abdominal_pain_001.json
const scenarioContent = {
  id: "acute_abdominal_pain_001",
  title: "배가 너무 아파요 (고령 남성)",
  description: "48세 남성 이춘배씨가 갑자기 배가 심하게 아파 응급실로 내원하였다.",
  type: "object",
  required: ["meta", "history", "additional_history", "physical_exam", "questions"],
  properties: {
    meta: {
      chief_complaint: "배가 너무 아파요",
      name: "이춘배",
      mrn: 965831,
      age: 48,
      sex: "남성",
      vitals: {
        bp: "95/60",
        hr: 110,
        rr: 24,
        bt: 37.8
      },
      attitude: "매우 고통스러워하며 말함",
      hybrid_skill: "없음"
    }
  },
  history: {
    "CC(chief_complaint)": ["배가 너무 아파요"],
    "O(onset)": ["3시간 전부터 갑자기 배가 너무 아팠어요."],
    "L(location)": ["명치가 제일 아파요.", "(방사통) 등하고 허리 쪽으로도 뻗치는 것 같이 아파요.", "(통증 위치 변화) 아픈 부위가 변하진 않았어요."],
    "D(duration)": ["지금 3시간째 계속 아파요."],
    "Co(course)": ["처음엔 그냥 버틸만 했는데 지금은 누워 있기도 힘들 정도예요."],
    "Ex(experience)": ["이렇게 심하게 아픈 건 처음이에요.", "예전엔 그냥 소화 안 될 때 더부룩한 정도였어요."],
    "C(character_of_chief_complaint)": ["쥐어짜는 듯이 아파요."],
    "pain_score": 9,
    "request_question": ["(통증에 대한 답변 후) 너무 아파서 그런데, 혹시 지금 진통제 좀 맞아도 될까요?"],
    "A(associated_symptoms)": ["(열)열이 좀 있는 것 같아요.", "(식욕)요즘 밥맛이 없어요.", "(체중)체중이 조금 줄었어요.", "(구역질/구토)구역질이 심하고 두 번 토했어요.", "(구토)토했을 때 아침에 먹었던 음식이 죄다 나왔어요.", "(구토)토에 피가 섞여 있진 않았어어요.", "(속 쓰림)가끔 속 쓰릴 때가 있어요.", "(호흡곤란)숨 쉬기도 조금 힘들어요.", "(복부 팽만감)배가 좀 빵빵하게 부른 느낌이에요.", "(소변량감소)소변도 평소보다 적게 나와요.", "(황달)피부나 눈은 노랗지 않아요.", "(변비)변비는 없어요.", "(설사)설사는 없어요.", "(대변)대변은 정상적이에요.", "(복부팽만감)배가 좀 빵빵하게 부른 느낌이에요."],
    "F(factors)": ["(음식-악화)기름진 음식 먹으면 더 아픈 것 같아요.", "(자세-악화)누우면 더 아파요.", "(자세-완화)몸을 앞으로 숙이면 조금 나아요."],
    "E(examination)": ["작년 건강검진에서 간 수치가 좀 높다고 들었어요."],
    "miscellaneous": ["아침밥 먹은 다음 설거지하다가 배가 너무 아파서 병원 왔어요.", "아침밥 먹은 지 6시간 정도 됐어요."]
  },
  additional_history: {
    "과(past_medical_history)": ["고혈압이 있어서 약 먹고 있어요.", "예전에 B형 간염 보균자라고 들었어요.", "(고혈압/간염 외 질환 - 당뇨/고지혈증 등) 없음"],
    "약(medication_history)": ["혈압약 하루 한 번 먹고 있습니다.", "고혈압 약 외에 다른 약은 안 먹고 있습니다."],
    "가(family_history)": ["가족 중에 비슷한 병 걸린 사람은 없어요."],
    "사(social_history)": {
      smoking: ["네, 담배 펴요.", "하루에 한 갑 정도요.", "20대 때부터 피웠어요."],
      alcohol: ["네, 마셔요.", "거의 이틀에 한 번 꼴로 마셔요.", "한 번 마실 때 소주 한 병 정도 마셔요.", "최근에 회식이 좀 잦았어요."],
      caffeine: ["커피 믹스 하루에 세 잔 정도 마셔요."],
      diet: ["규칙적으로 먹는 편이에요.", "삼겹살이나 치킨 같은 기름진 음식을 좀 좋아해요."],
      exercise: ["운동 거의 안해요."],
      job: ["반도체 회사에서 인사 담당 하고 있어요."]
    },
    "외(trauma_history)": ["배 다친 적 없어요.", "수술받은 적도 없어요."],
    "여(ob_history)": ["해당 없음."],
    "여(travel_history)": ["최근에 여행 갔다 온 적 없어요."]
  },
  physical_exam: {
    "전신상태": ["(외관)얼굴이 창백하고 식은땀을 흘립니다."],
    "머리/눈/코/입/귀": ["(눈 결막)결막은 창백합니다.", "(눈 공막)정상", "(구강/혀)혀가 말라 있습니다."],
    "경부_목": ["(경부 림프절) 정상", "(갑상선) 정상"],
    "흉부_폐": ["(흉부 시진) 정상", "(흉부 촉진) 정상", "(호흡음 청진) 정상", "(흉부 타진) 정상"],
    "심장": ["(심음 청진)심음은 빠르고 규칙적입니다"],
    "복부_배": ["(시진-눈으로 볼 때)배가 전체적으로 팽만해 보입니다.", "(청진-장 소리 들을 때)장음이 감소되어 잘 들리지 않습니다.", "(타진-두들길 때)복부 전체에서 타진음이 둔탁합니다.", "(촉진-눌렀을 때)명치 부위 압통이 있습니다.", "(촉진-뗄 때) 반발 압통도 있습니다.", "(간 촉진) 정상", "(비장 촉진) 정상", "(Psoas sign) 정상", "(Rovsing sign) 정상", "(McBurney sign) 정상", "(Obturator sign) 정상", "(Murphy sign) 정상", "(직장수지검사) 정상"],
    "등/상지_팔/하지_다리": ["(CVAT tenderness) 정상", "(하지부종) 정상"],
    "뇌신경_운동신경_감각신경": ["(의식) 정상", "(뇌신경) 정상", "(운동신경) 정상", "(감각신경) 정상"],
    "피부": ["(피부 색조) 정상", "(발진) 정상", "(황달) 정상"],
    "기타": []
  }
};

// Checklist snapshot
const checklistItemsSnapshot = {
  history: [
    { id: "HX-01", title: "[윗배] 가슴통증, 소화불량 감별", criteria: "가슴통증이나 소화불량을 감별하였는가?", example: ["가슴이 아프다거나, 소화가 잘 안되는 느낌은 아닌가요?"] },
    { id: "HX-02", title: "통증 위치 문진", criteria: "통증 위치를 짚어보게 하는 등 위치 관련 질문을 하였는가?", example: ["아픈 부위가 정확히 어디인가요?"] },
    { id: "HX-03", title: "통증 시간적 특성", criteria: "통증의 기간, 지속 여부, 주기성, 과거 발생 여부 등을 물어보았는가?", example: ["아픈게 계속 지속되나요? 이전에도 이런 적이 있었나요?"] },
    { id: "HX-04", title: "통증 양상", criteria: "쥐어짜는 듯, 콕콕 쑤시는 듯, 박동성 등 통증 양상에 대해 질문하였는가?", example: ["아픈 부위가 쥐어짜는 듯 하나요? 콕콕 쑤시는 듯 하나요? 칼로 베는 듯한 통증인가요?"] },
    { id: "HX-05", title: "방사통 확인", criteria: "어깨나 등으로 퍼지는 통증 여부를 확인하였는가?", example: ["어깨나 등으로 퍼지지는 않나요?"] },
    { id: "HX-06", title: "통증 정도와 일상생활 지장", criteria: "통증의 강도(VAS 점수)나 일상생활 지장 여부를 확인하였는가?", example: ["통증이 얼마나 심한가요?", "아예 안아픈 걸 0점, 엄청 아픈 걸 10점이라고 하면, 몇 점 정도 아프신가요?", "일상생활에 지장이 있나요?"] },
    { id: "HX-07", title: "악화 요인 확인", criteria: "기침, 배를 쭉 피는 등 자세 변화, 지방 식이(췌장염 예상) 등 통증을 악화시키는 요인을 물어보았는가?", example: ["기침하거나 배를 쭉 피면 더 아프신가요?", "기름기 많은 음식을 먹으면 더 아프신가요?"] },
    { id: "HX-08", title: "전신 증상 확인", criteria: "발열, 오한, 체중 변화, 피로감 등 전신 증상을 확인하였는가?", example: ["열 있으신가요?", "오한은요?", "최근에 체중이 빠지거나 찌진 않았나요?", "많이 피곤하진 않으신가요?"] },
    { id: "HX-09", title: "식욕부진, 구역, 구토", criteria: "식욕부진, 구역, 구토를 물어보았는가?", example: ["식욕은 어떠세요?", "구역이나 구토는 없으신가요?"] },
    { id: "HX-10", title: "변비, 설사, 혈변, 지방변", criteria: "변비, 설사, 혈변, 지방변을 물어보았는가?", example: ["변비가 있거나 설사가 있으신가요?", "변에서 피가 나오진 않으시나요?", "변에 기름이 둥둥 떠있나요?"] },
    { id: "HX-11", title: "황달, 복부팽만", criteria: "황달, 복부팽만을 물어보았는가?", example: ["눈이나 피부가 노랗게 되거나 하진 않으시나요?", "배가 부풀어졌나요?", "소변이 흰색이나 황색이 아닌 것 같나요?"] },
    { id: "HX-12", title: "식습관 확인", criteria: "식습관에 대해 질문하였는가?", example: ["평소 음식은 규칙적으로 드시나요?", "뭐 주로 드시나요?"] },
    { id: "HX-13", title: "운동 확인", criteria: "운동 여부를 질문하였는가?", example: ["운동은 좀 하시나요?", "얼마나 자주 하시나요?"] },
    { id: "HX-14", title: "과거력 확인", criteria: "소화기나 대사 관련 만성질환인 쓸개돌-담석-담도-담남염-이자염/대장암 등이 있는지 확인하였는가?", example: ["소화기 질환 앓고 계신 것 있으신가요?", "쓸개돌, 담석, 담도, 담남염, 이자염, 대장암 등이 진단 받은 적 있으신가요?"] },
    { id: "HX-15", title: "복용 중인 약물 확인", criteria: "소염진통제, 소화제, 경구혈당강하제, 고혈압약, 항혈소판 제제(아스피린), 건강기능식품 등 복용 중인 약물 여부를 확인하였는가?", example: ["현재 복용 중인 약 있으신가요? 소화제나 경구혈당강하제 복용 중이신가요? 건강기능식품같은 건 안드시나요?"] },
    { id: "HX-16", title: "음주력 확인", criteria: "음주 여부를 확인하였는가?", example: ["술은 마시시나요?", "술을 얼마나 자주 드시나요?", "술 드실 때 한 번에 얼마나 마시시나요?"] },
    { id: "HX-17", title: "흡연력 확인", criteria: "흡연 여부를 확인하였는가?", example: ["담배는 피우시나요?", "담배를 얼마나 자주 피우시나요?", "담배 피실 때 한 번에 얼마나 피우시나요?"] },
    { id: "HX-18", title: "카페인 섭취 확인", criteria: "커피나 카페인 섭취 여부를 확인하였는가?", example: ["커피는 드시나요?", "커피를 얼마나 자주 드시나요?", "커피 드실 때 한 번에 얼마나 드시나요?"] },
    { id: "HX-19", title: "가족력", criteria: "쓸개돌, 담석, 담도-담남염, 이자염, 대장암 등 가족의 소화기 관련 질환 여부를 확인하였는가?", example: ["가족분들 중에 쓸개돌, 담석, 담도, 담남염, 이자염, 대장암 등 진단 받으신 분이 있으신가요?"] },
    { id: "HX-20", title: "외상/수술/입원력", criteria: "복부 외상, 수술 유무, 입원 유무를 확인하였는가?", example: ["배 다친 적 있으신가요?", "수술 받은 적 있으신가요?", "입원하신 적 있으신가요?"] }
  ],
  physicalExam: [
    { id: "PE-01", title: "눈 진찰", criteria: "눈을 진찰하여 황달이나 빈혈 여부를 확인하였는가? (위로 쳐다보게 한 뒤 결막을 내려 확인)", example: ["눈 한 번 보도록 하겠습니다."] },
    { id: "PE-02", title: "탈수 유무 확인", criteria: "탈수 유무를 확인하였는가? (혀, 피부 긴장도 확인)", example: ["혀 한 번 내밀어보시겠어요?", "손 꼬집어서 피부 탄력도 좀 확인해볼게요."] },
    { id: "PE-03", title: "복부 진찰 자세", criteria: "복부 진찰을 위해 환자를 바로 눕히고 양쪽 무릎을 세우게 하였는가?", example: ["누워서 보도록 하겠습니다. 양쪽 무릎을 세워주시고요."] },
    { id: "PE-04", title: "복부 진찰 순서", criteria: "복부 진찰을 시진 → 청진 → 타진 → 촉진 순서로 시행하였는가?", example: ["눈으로 봤을 때 이상 소견은 없는 것 같습니다. → 소리 좀 들어볼게요. → 좀 두들겨볼게요. → 눌러볼텐데 아프시면 말씀해주세요."] },
    { id: "PE-05", title: "반발통 확인", criteria: "통증이 심한 부위를 마지막으로 촉진하고 반발통 여부를 확인하였는가?", example: ["아픈 부위 마지막으로 눌러볼게요. 눌렀을 때 아프세요, 뗄 때 아프세요?"] },
    { id: "PE-06", title: "간/비장 촉진", criteria: "간과 비장을 촉진하였는가? (간: 양손을 Rt. costal margin에 대고 심호흡 시킴, 비장: 왼손을 Lt. flank에 두고 오른손으로 Lt. costal margin 아래를 눌러 확인)", example: ["간 좀 만져볼게요.", "비장도 만져보겠습니다."] },
    { id: "PE-07", title: "CVAT 확인", criteria: "늑골척추각(CVAT) 압통 여부를 확인하였는가?", example: ["등도 한 번 두들겨볼게요. 아프신가요?"] },
    { id: "PE-08", title: "충수돌기염 감별 검사", criteria: "급성 충수돌기염 감별을 위한 이학적 검사를 시행하였는가? (예: Psoas sign, McBurney's point tenderness, Rovsing sign 중 2가지 이상)", example: ["왼 쪽으로 돌아누워주시겠어요? 오른쪽 다리 한 번 뒤로 해볼텐데, 아프시면 말씀해주세요.", "배꼽과 돌기의 2대 1 지점 한 번 눌러보겠습니다. 왼쪽 아래 눌러볼텐데, 오른쪽 아래가 아프시면 말씀해주세요."] }
  ],
  education: [
    { id: "ED-01", title: "가능한 원인/질환 설명", criteria: "예상되는 원인이나 병명을 환자에게 설명하였는가?", example: ["진찰한 결과 ~~가 의심이 됩니다."] },
    { id: "ED-02", title: "검사 필요성 설명", criteria: "향후 시행할 검사나 확진 검사의 필요성을 설명하였는가?", example: ["다른 여러 질환들을 감별하기 위해 검사A, 검사B, 검사C를 진행해봐야 할 것 같은데 괜찮으실까요?"] },
    { id: "ED-03", title: "금식 안내", criteria: "내시경 등의 검사가 필요한 경우 금식이 필요함을 안내하였는가?", example: ["내시경 검사를 하기 위해선 금식이 필요합니다. 혹시 8시간 전부터 드신 거 있으실까요?"] },
    { id: "ED-04", title: "치료 계획 설명", criteria: "향후 시행할 치료 계획(예: 금식 유지, 내시경 시술 등)을 설명하였는가?", example: ["만약 ~~로 진단이 되면 ~~를 하겠습니다."] },
    { id: "ED-05", title: "생활습관 교육", criteria: "일상생활에서 위험성을 줄일 수 있는 방법(예: 운동, 식습관)을 교육하였는가?", example: ["담배 좀 끊어보시고요.", "술은 좀 줄이시고요.", "운동도 한 번 시도해보시면 어떨까 합니다."] },
    { id: "ED-06", title: "재방문/입원 필요성 안내", criteria: "재방문 시기나 입원 필요성(예: 담낭염, 복막염, 장폐색 등 응급 수술 가능성)을 설명하였는가?", example: ["그러면 2주뒤에 뵙도록 하겠습니다. 입원하실 필요는 없을 것 같습니다."] }
  ],
  ppi: [
    { id: "PPI-01", title: "자기 소개", criteria: "본인의 이름과 역할(학생의사 등)을 명확히 소개하였는가?", example: [] },
    { id: "PPI-02", title: "환자 확인", criteria: "환자의 성함과 나이를 확인하였는가?", example: [] },
    { id: "PPI-03", title: "일상적 배려 대화", criteria: "날씨, 병원까지 오시는 교통편 등 일상적 배려 표현을 하였는가?", example: [] },
    { id: "PPI-04", title: "공감 표현", criteria: "진정성 있는 공감 표현을 하였는가?", example: ["힘드셨겠네요", "제가 도와드리겠습니다"] },
    { id: "PPI-05", title: "중간 요약", criteria: "환자의 병력을 3~4가지 특징으로 중간 요약하였는가?", example: ["잠시 요약을 해보자면"] },
    { id: "PPI-06", title: "신체진찰 설명 및 동의", criteria: "본격적인 신체 진찰 전에, 신체 진찰 내용을 설명하고 동의까지 구하였는가?", example: ["신체 진찰을 수행할텐데, 손이 좀 닿을 수 있습니다. 괜찮으실까요?"] },
    { id: "PPI-07", title: "신체진찰 후 환자 배려", criteria: "신체진찰 후 환자에게 시간을 주고 다음 진료를 이어나갈 수 있도록 옷 정리나 자리 이동을 지시하거나, 신체 진찰 도중에 불편한 점 있었는지 확인하였는가?", example: ["옷 정리하셔도 됩니다", "자리로 가서 앉아주시면 됩니다"] },
    { id: "PPI-08", title: "환자 입장 파악", criteria: "환자의 관점과 걱정을 파악하기 위한 질문을 하였는가?", example: ["혹시 걱정되시는 것이 있으신가요?"] },
    { id: "PPI-09", title: "이해하기 쉬운 설명", criteria: "비전문 용어로 핵심을 설명하고 과도한 의학 용어 사용을 자제하였는가?", example: [] },
    { id: "PPI-10", title: "환자 이해도 확인", criteria: "환자가 의사의 설명을 잘 이해했는지 재확인하고, 이해 못한 부분이 있다고 하면 다시 설명해주었는가?", example: ["환자분, 지금까지 이해 안 되는 것 있었나요?"] },
    { id: "PPI-11", title: "질문 기회 제공", criteria: "환자에게 질문할 기회를 명확히 제공하였는가?", example: ["궁금한 것 있으신가요?"] }
  ]
};

// All checklist items included by default
const checklistIncludedMap: Record<string, boolean> = {};
[...checklistItemsSnapshot.history, ...checklistItemsSnapshot.physicalExam, ...checklistItemsSnapshot.education, ...checklistItemsSnapshot.ppi].forEach(item => {
  checklistIncludedMap[item.id] = true;
});

// Commentary content
const commentaryContent = {
  html: `이춘배씨는 <strong>갑작스러운 상복부 통증과 복부 팽만, 반발압통, 저혈압</strong>을 보이는 환자입니다.
지금 이 상황에서 <strong>가장 먼저 떠올려야 할 것은 '복막염이나 쇼크로 진행 중인 응급 복부 질환'</strong>입니다. 활력징후를 통해 <strong>혈압(95/60)과 맥박(110)</strong>을 즉시 확인하고, 복부진찰에서 <strong>반발압통·장음 감소</strong> 여부를 체크해야 했습니다. 이러한 확인이 바로 <strong>상황 인식(Situational awareness)</strong> 의 핵심이에요.

통증 양상은 <strong>쥐어짜는 듯한 명치 통증이 등으로 방사</strong>되는 형태로, <strong>급성췌장염</strong>을 강하게 시사합니다. 그러나 이 연령대와 음주력, 체온 상승(37.8°C), 복막 자극 징후까지 고려하면 <strong>천공성 위궤양</strong>도 충분히 감별 대상입니다. 따라서 <strong>'췌장염 vs 천공성 위궤양'</strong>처럼 <strong>두 가지 이상 주요 가설을 설정(Hypothesis generation)</strong> 하는 것이 좋습니다.

이때 각 질환의 단서를 명확히 연결해 <strong>임상적 인과관계(Data Interpretation)</strong>을 추론해야 합니다. 예를 들어

- <strong>"등으로 방사되는 통증 + 구토 + 술 자주 마심 → 급성췌장염"</strong>
- <strong>"복부 팽만 + 반발압통 + 장음 감소 → 천공성 복막염"</strong>
처럼 말이죠.

마지막으로, 감별을 위해선 <strong>혈청 아밀레이스·리파아제, CBC, 복부 단순 X선(공기음영 확인), 복부 초음파 또는 CT</strong>를 계획해야 합니다. 각각의 검사는 <strong>진단 가설을 확인·배제하기 위한 구체적 목적</strong>이 분명해야 하며, 혹여나 <strong>패혈증 위험이 높다면 즉시 수액과 항생제, 금식 및 응급 외과 협진</strong>까지 연결되어야 합니다.

<strong>본인이 진료하며 떠올린 '생각의 흐름'을 한번 점검해보세요!</strong>`
};

async function main() {
  console.log("Creating scenario for 급성복통...");

  try {
    // Check if scenario already exists
    const existing = await prisma.scenario.findFirst({
      where: {
        chiefComplaint: "급성복통",
        caseName: "급성복통_001",
      },
      orderBy: { versionNumber: "desc" },
    });

    if (existing) {
      console.log(`Scenario already exists with version ${existing.versionNumber}. Updating...`);

      // Update existing scenario
      const updated = await prisma.scenario.update({
        where: { id: existing.id },
        data: {
          scenarioContent,
          checklistItemsSnapshot,
          checklistIncludedMap,
          checklistConfirmedAt: new Date(),
          commentaryContent,
          commentaryUpdatedAt: new Date(),
          status: "PUBLISHED",
          publishedAt: new Date(),
        },
      });

      console.log("Scenario updated:", updated.id);
    } else {
      // Create new scenario
      const scenario = await prisma.scenario.create({
        data: {
          chiefComplaint: "급성복통",
          caseName: "급성복통_001",
          versionNumber: 0.1,
          status: "PUBLISHED",
          publishedAt: new Date(),
          scenarioContent,
          checklistItemsSnapshot,
          checklistIncludedMap,
          checklistConfirmedAt: new Date(),
          commentaryContent,
          commentaryUpdatedAt: new Date(),
        },
      });

      console.log("Scenario created:", scenario.id);
    }

    console.log("Done!");
  } catch (error) {
    console.error("Error:", error);
  } finally {
    await prisma.$disconnect();
    await pool.end();
  }
}

main();
