{ pkgs, ... }: {
  # 사용할 도구들을 설치합니다.
  packages = [
    pkgs.nodejs_20
  ];

  # IDX 환경 설정
  idx = {
    # 사용할 확장 프로그램
    extensions = [
      "ritwickdey.LiveServer"
    ];

    # 미리보기 설정
    previews = {
      enable = true;
      previews = {
        web = {
          # 앱을 9000번 포트로 실행하도록 고정합니다.
          command = ["npx" "live-server" "." "--port=$PORT" "--no-browser"];
          manager = "web";
        };
      };
    };
  };
}