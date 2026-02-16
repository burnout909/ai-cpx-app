---
name: add-vp
description: 새로운 가상환자(Virtual Patient) 시나리오를 생성하고 등록합니다. VP JSON, 프로필 이미지, solution 파일을 생성하고 loadVirtualPatient.ts에 등록합니다.
disable-model-invocation: true
argument-hint: "<영문이름> <한국어케이스명>"
---

# 가상환자 시나리오 추가

## Usage
```
/add-vp <영문이름> <한국어케이스명>
```
예시: `/add-vp insomnia_001 불면증`

## Steps

### 1. VP JSON 파일 생성
- **파일**: `src/assets/virtualPatient/<영문이름>.json`
- **참조 패턴**: `src/assets/virtualPatient/acute_abdominal_pain_001.json`
- **필수 구조**:
  ```json
  {
    "id": "<영문이름>",
    "title": "주호소 (환자 설명)",
    "description": "XX세 성별 이름씨가 ... 내원하였다.",
    "type": "object",
    "required": ["meta", "history", "additional_history", "physical_exam", "questions"],
    "properties": {
      "meta": {
        "chief_complaint": "주호소",
        "name": "환자이름",
        "mrn": 123456,
        "age": 48,
        "sex": "남성/여성",
        "vitals": { "bp": "120/80", "hr": 72, "rr": 18, "bt": 36.5 },
        "attitude": "환자 태도 설명",
        "hybrid_skill": "없음"
      }
    },
    "history": {
      "CC(chief_complaint)": ["주호소 발화"],
      "O(onset)": ["발병 시점"],
      "L(location)": ["통증 위치"],
      "D(duration)": ["지속 기간"],
      "Co(course)": ["경과"],
      "C(character_of_chief_complaint)": ["양상"],
      "A(associated_symptoms)": ["동반 증상들"],
      "F(factors)": ["악화/완화 요인"]
    },
    "additional_history": {
      "과(past_medical_history)": ["과거력"],
      "약(medication_history)": ["약물력"],
      "가(family_history)": ["가족력"],
      "사(social_history)": { "smoking": [], "alcohol": [], "etc": [] }
    },
    "physical_exam": { ... },
    "questions": ["환자 질문"]
  }
  ```

### 2. Solution 파일 생성
- **파일**: `src/assets/virtualPatient/<영문이름>_solution.ts`
- **패턴**: default export로 정답/해설 문자열 내보내기

### 3. 프로필 이미지
- **파일**: `src/assets/virtualPatient/<영문이름>.png`
- 환자 프로필 이미지 (사용자가 별도 제공해야 함)

### 4. loadVirtualPatient.ts에 등록
- **파일**: `src/utils/loadVirtualPatient.ts`
- 3곳에 추가 필요:
  1. `loadVirtualPatient()` switch문에 case 추가
  2. `CASE_TO_IMAGE` 매핑에 추가
  3. `CASE_TO_SOLUTION` 매핑에 추가
- **패턴**:
  ```typescript
  // loadVirtualPatient switch
  case "한국어케이스명":
    return (await import("@/assets/virtualPatient/<영문이름>.json")).default as VirtualPatient;

  // CASE_TO_IMAGE
  "한국어케이스명": () => import("@/assets/virtualPatient/<영문이름>.png"),

  // CASE_TO_SOLUTION
  "한국어케이스명": () => import("@/assets/virtualPatient/<영문이름>_solution"),
  ```

### 5. 스키마 검증
- `src/utils/virtualPatientSchema.ts`의 스키마에 맞는지 확인
- VP JSON 인터페이스: `VirtualPatient` (from `loadVirtualPatient.ts`)
- 필수 필드: `id`, `title`, `description`, `type`, `required`, `properties.meta`, `history`, `additional_history`, `physical_exam`

### 6. 검증
- `npm run build`로 빌드 확인
- JSON 파일이 올바른 형식인지 확인
