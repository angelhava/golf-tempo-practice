{ pkgs, ... }: {
  # 사용할 도구 설치
  packages = [
    pkgs.nodejs_20
  ];

  # IDE 설정
  idx = {
    # 필요한 확장 프로그램 자동 설치
    extensions = [
      "ritwickdey.LiveServer"
    ];

    # 미리보기 설정
    previews = {
      enable = true;
      # 'web'이라는 이름의 미리보기를 설정
      web = {
        # 이 명령어로 웹 서버를 실행합니다.
        command = ["npx" "http-server" "-p" "$PORT" "--cors"];
        manager = "web";
      };
    };
  };
}
