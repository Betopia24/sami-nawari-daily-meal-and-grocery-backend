const fs = require('fs');

let ctrl = fs.readFileSync('src/app/modules/cart/cart.controller.ts', 'utf8');

const oldAdd = `const addItemToCart = catchAsync(async (req: Request & { user?: any }, res: Response) => {
  const decodedUser = req.user as any;
  const result = await CartService.addItemToCart(decodedUser.userId, req.body);`;

const newAdd = `const addItemToCart = catchAsync(async (req: Request & { user?: any }, res: Response) => {
  const decodedUser = req.user as any;

  if (decodedUser?.role === "SELLER") {
    throw new ApiError(
      403,
      "Sellers cannot add items to cart. Please switch to Buyer mode first, then add to cart."
    );
  }

  const result = await CartService.addItemToCart(decodedUser.userId, req.body);`;

ctrl = ctrl.replace(/\r\n/g, '\n');
const oldAddNormalized = oldAdd.replace(/\r\n/g, '\n');

if (ctrl.includes(oldAddNormalized)) {
  ctrl = ctrl.replace(oldAddNormalized, newAdd.replace(/\r\n/g, '\n'));
  // Ensure ApiError is imported
  if (!ctrl.includes("import ApiError")) {
    ctrl = `import ApiError from "../../errors/apiError";\n` + ctrl;
  }
  fs.writeFileSync('src/app/modules/cart/cart.controller.ts', ctrl, 'utf8');
  console.log('cart.controller.ts updated');
} else {
  console.log('oldAdd not found in cart.controller.ts');
}

