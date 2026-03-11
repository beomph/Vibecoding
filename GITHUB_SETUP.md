# GitHub 새 저장소 업로드 가이드

## 완료된 작업
- ✅ creative 폴더 (NOVA 랜딩 페이지) 커밋 완료

## 남은 단계

### 1. GitHub 로그인
터미널에서 다음 명령을 실행하세요:
```
gh auth login --web --git-protocol https
```
- 브라우저가 열리면 **코드 6E9A-2970** 입력 (또는 새로 생성된 코드 사용)
- GitHub 로그인 후 승인

### 2. 새 저장소 생성 및 푸시
로그인 완료 후, 프로젝트 폴더에서 실행:

```powershell
cd "c:\Users\Administrator\Downloads\랜딩페이지 연습1"

# 새 저장소 생성 (이름은 원하는 대로 변경 가능)
gh repo create landing-page-practice --source=. --public --push
```

- `landing-page-practice` → 원하는 저장소 이름으로 변경 가능
- `--public` → 공개 저장소 (비공개는 `--private`)

### 3. 기존 origin이 있는 경우
현재 origin이 Vibecoding을 가리키고 있어서, 새 저장소만 푸시하려면:

```powershell
# 새 저장소 생성 (원격은 자동 추가됨)
gh repo create landing-page-practice --source=. --public --push --remote neworigin
```

또는 기존 origin을 교체하고 새 저장소로 푸시:

```powershell
gh repo create landing-page-practice --source=. --public --push
# gh가 새 저장소를 origin으로 설정하고 푸시합니다
```
