# Screenshot menu import and image sources

The menu import data is in `backend/data/menu-import-2026-11-20.json`; photo metadata and individual source pages are in `backend/data/menu-image-sources.json`. New Unsplash image URLs request a 1200×1200 cropped rendition. The application caches remote product photos and shows a shopping-bag fallback when a photo is absent or fails to load.

New photo references were selected from Unsplash and checked against its [license](https://unsplash.com/license), which permits broad commercial use subject to its restrictions. This does not grant rights to brand marks or product packaging, so the Diet Coke and Pepsi rows intentionally use the image fallback until Wrapchik has approved product photos. Existing catalogue images on the two matched products were retained rather than replaced.

| Menu image | Creator | Source |
|---|---|---|
| Iced latte | Demi DeHerrera | [Unsplash photo](https://unsplash.com/photos/glass-cup-filled-with-ice-latte-on-tabletop-L-sm1B4L1Ns) |
| Iced coffee | Winston Chen | [Unsplash photo](https://unsplash.com/photos/iced-coffee-with-milk-and-ice-in-a-glass-nIZl9PuwMXk) |
| Crispy chicken burger | Allen Y | [Unsplash photo](https://unsplash.com/photos/a-crispy-chicken-burger-with-french-fries-Omyk3J_LPfk) |
| Chicken burger with lettuce | Shoeib Abolhassani | [Unsplash photo](https://unsplash.com/photos/a-delicious-chicken-burger-with-lettuce-and-cucumber-S9CjBUhWZus) |
| Veggie burger | Israel Albornoz | [Unsplash photo](https://unsplash.com/photos/burger-and-fries-on-brown-wooden-round-plate-Le25t7xIoaE) |
| Chicken wrap | Advocator SY | [Unsplash photo](https://unsplash.com/photos/a-black-plate-topped-with-a-burrito-and-a-salad-MdkUEKFfkTM) |
| Vegetable salad | Elena Leya | [Unsplash photo](https://unsplash.com/photos/a-colorful-salad-bowl-with-many-fresh-ingredients-_vy3L5n8VnI) |
| Chicken salad | Ani Augustine | [Unsplash photo](https://unsplash.com/photos/grilled-chicken-salad-with-avocado-and-tomatoes-9TogNg01qzI) |
| Vada pav | Zoshua Colah | [Unsplash photo](https://unsplash.com/photos/vada-pav-a-popular-indian-street-food-nNIHe72pa60) |
| Fries | Cindy Bartillon | [Unsplash photo](https://unsplash.com/photos/a-pile-of-golden-french-fries-on-a-white-plate--doMDpFipzQ) |
| Truffle chips / fries | Vera Cho | [Unsplash photo](https://unsplash.com/photos/french-fries-in-fry-basket-lv7H9OKj_f4) |
| Onion rings | Satria Setiawan | [Unsplash photo](https://unsplash.com/photos/a-white-plate-topped-with-onion-rings-next-to-a-bowl-of-dipping-sauce-hhq8Z76ODrU) |
| Chicken tenders / popcorn chicken | Lee Milo | [Unsplash photo](https://unsplash.com/photos/basket-of-fried-chicken-tenders-fries-and-popcorn-chicken-bG8sQGD8Bi8) |
| Chicken nuggets | Proper Quality Shandis | [Unsplash photo](https://unsplash.com/photos/a-plate-of-fried-chicken-zE8wKvGPcDg) |
| Nachos | Erick Su | [Unsplash photo](https://unsplash.com/photos/nachos-on-oval-tray-WjBp05j8LXI) |

The vegetables-in-wrap image already used by the project was reused for matching wrap products; its original photographer page was not recorded, so it is marked as an existing app asset rather than a newly verified image source. The import registry keeps the exact photo IDs and source metadata used to build product URLs.

## Safe development database import

From `backend/`, the command below only prints a plan and does not write to MongoDB:

```powershell
npm run db:import-menu
```

The reviewed import can be safely repeated with:

```powershell
npm run db:import-menu -- --apply --confirm-dev-db
```

The importer refuses anything other than the local `wrapchik` development database. It changes only `Product` and `Category` documents, keeps historical records, and never accesses orders or payments. Five ellipsized names are kept out of the import manifest's active rows until their full names can be confirmed. Screenshot-clipped descriptions remain blank, and items with no suitably matched photo use the app fallback.
