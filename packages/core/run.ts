import Scanner from "../scanner";

export async function run() {
  const scanner = new Scanner('src');
  const scanResult = await scanner.scan();
}

run()