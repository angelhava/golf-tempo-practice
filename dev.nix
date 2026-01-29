{ pkgs, ... }: {
  # The command to run when starting the development environment
  startCommand = "npx http-server -p $PORT";

  # The set of packages to be available in the development environment
  packages = [
    pkgs.nodejs_20
    pkgs.jest
  ];

  # Network settings
  network.ports = [
    # The port to expose to the outside world
    8080
  ];
}
