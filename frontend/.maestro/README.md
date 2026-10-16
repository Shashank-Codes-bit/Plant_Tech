# Maestro flows

UI tests that drive the **NurseryPOS Dev** app (`com.planteck.nurserypos.dev`) on an Android phone or emulator, using the app's `testID`s.

| Flow | What it does |
|---|---|
| `owner-signup-setup.yaml` | Wipes the app, signs up a new owner (random phone), walks the 5 setup steps to Home |
| `add-product.yaml` | Products → Add product → Create new → price, stock → Save |
| `new-order.yaml` | New order → type the product → Add → Take payment → Cash → bill paid |

`config.yaml` runs them in that order, so the product exists before it's sold. Each run of `owner-signup-setup` makes a new owner account on the **staging** server.

## One-time setup

1. Install the Dev app on the phone: build it with `npx eas-cli build --profile development --platform android` and open the link EAS gives you.
2. Install the [Maestro CLI](https://docs.maestro.dev/getting-started/installing-maestro) (on Windows: Java 17+, then the release zip on your PATH; or run it inside WSL).
3. Turn on USB debugging on the phone and check `adb devices` lists it.

## Run

```bash
# 1. In frontend/: serve the JS. frontend/.env must point EXPO_PUBLIC_BACKEND_URL at staging (see .env.example).
npx expo start

# 2. In another terminal: let the phone reach Metro on the PC as localhost:8081
adb reverse tcp:8081 tcp:8081

# 3. Run all flows, or one
maestro test .maestro
maestro test .maestro/new-order.yaml
```

The flows open the app with `nurserypos-dev://expo-development-client/?url=…`, so the Dev app loads the JS from your PC, not from the launcher screen.

## Options

Pass with `-e NAME=value`:

| Name | Default | |
|---|---|---|
| `DEV_SERVER_URL` | `http://localhost:8081` | Metro address. Use `http://<PC LAN IP>:8081` instead of `adb reverse` over Wi-Fi |
| `PRODUCT` | `Maestro Money Plant` | Product created by `add-product` and sold by `new-order`. Letters, digits and spaces only (it's matched as a regex) |
| `PRICE`, `STOCK` | `150`, `10` | For `add-product` |
| `OWNER_NAME`, `SHOP_NAME`, `PASSWORD` | `Maestro Owner`, `Maestro Nursery`, `maestro-test-1` | For `owner-signup-setup` |

`new-order` and `add-product` need an owner who is already logged in with a set-up shop, which is what `owner-signup-setup` leaves behind.
