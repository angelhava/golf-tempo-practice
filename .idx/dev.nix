{ pkgs, ... }: {
  # 1. 사용할 도구 설치 (자동)
  packages = [
    pkgs.nodejs_20
  ];

  # 2. 서버가 켜질 때 실행할 설정
  idx = {
    # 사용할 확장 프로그램 (자동 설치)
    extensions = [
      "ritwickdey.LiveServer"
    ];

    # 화면에 미리보기를 자동으로 띄우는 설정
    previews = {
      enable = true;
      previews = {
        web = {
          # 서버 실행 명령어 (npx http-server를 자동으로 실행)
          command = ["npx" "http-server" "-p" "$PORT"];
          manager = "web";
        };
      };
    };
  };
}