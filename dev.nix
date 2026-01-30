{ pkgs, ... }: {
  # 환경이 시작될 때 실행될 명령어
  startCommand = "npx http-server -p $PORT --cors";

  # 설치할 도구들
  packages = [
    pkgs.nodejs_20
  ];

  # 네트워크 설정
  network.ports = [
    8080
  ];

  # ⭐ 이 부분이 추가되어야 Preview 버튼이 작동합니다!
  idx = {
    previews = {
      enable = true;
      previews = {
        web = {
          command = ["npx" "http-server" "-p" "$PORT" "--cors"];
          manager = "web";
        };
      };
    };
  };
}
