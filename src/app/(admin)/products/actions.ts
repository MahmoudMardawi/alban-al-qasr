"use server";

import { createClient } from "@/lib/supabase/server";
import { logActivity } from "@/lib/activity-log";
import { validateProductInput, validatePackageInput, type ProductInput, type PackageInput } from "@/lib/admin-validation";
import { revalidatePath } from "next/cache";

export interface ProductWithPackages {
  product: ProductInput & { is_active?: boolean };
  packages: Array<PackageInput & { is_active?: boolean }>;
}

export async function createProduct(input: ProductWithPackages): Promise<{ id?: string; error?: string }> {
  const pv = validateProductInput(input.product);
  if (!pv.ok) return { error: pv.error };
  for (const pkg of input.packages) {
    const v = validatePackageInput(pkg);
    if (!v.ok) return { error: `عبوة "${pkg.package_name}": ${v.error}` };
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "غير مسجّل دخول" };

  const { data: product, error: prodErr } = await supabase
    .from("products")
    .insert({
      name_ar:    input.product.name_ar.trim(),
      base_unit:  input.product.base_unit as "L" | "kg" | "piece",
      base_price: input.product.base_price,
      base_cost:  input.product.base_cost,
    })
    .select("id, name_ar")
    .single();

  if (prodErr || !product) return { error: prodErr?.message ?? "تعذّر إنشاء المنتج" };

  if (input.packages.length > 0) {
    const { error: pkgErr } = await supabase.from("product_packages").insert(
      input.packages.map((pkg) => ({
        product_id:    product.id,
        package_name:  pkg.package_name.trim(),
        contains_qty:  pkg.contains_qty,
        package_price: pkg.package_price,
      })),
    );
    if (pkgErr) {
      await supabase.from("products").delete().eq("id", product.id);
      return { error: pkgErr.message };
    }
  }

  await logActivity(supabase, {
    actor_id: user.id, action: "product_added",
    entity_type: "product", entity_id: product.id,
    summary_ar: `أضاف منتج جديد: ${product.name_ar}`,
    payload: { packages_count: input.packages.length },
  });

  revalidatePath("/products");
  return { id: product.id };
}

export async function updateProduct(productId: string, input: Pick<ProductWithPackages, "product">): Promise<{ error?: string }> {
  const pv = validateProductInput(input.product);
  if (!pv.ok) return { error: pv.error };

  const supabase = await createClient();
  const { error } = await supabase
    .from("products")
    .update({
      name_ar:    input.product.name_ar.trim(),
      base_unit:  input.product.base_unit as "L" | "kg" | "piece",
      base_price: input.product.base_price,
      base_cost:  input.product.base_cost,
      is_active:  input.product.is_active ?? true,
    })
    .eq("id", productId);

  if (error) return { error: error.message };

  revalidatePath("/products");
  revalidatePath(`/products/${productId}`);
  return {};
}

export async function deleteProduct(productId: string): Promise<{ error?: string }> {
  const supabase = await createClient();

  const { count } = await supabase
    .from("visit_lines")
    .select("id", { count: "exact", head: true })
    .eq("product_id", productId);

  if ((count ?? 0) > 0) {
    const { error } = await supabase.from("products").update({ is_active: false }).eq("id", productId);
    if (error) return { error: error.message };
  } else {
    const { error } = await supabase.from("products").delete().eq("id", productId);
    if (error) return { error: error.message };
  }

  revalidatePath("/products");
  return {};
}

export async function addPackage(productId: string, pkg: PackageInput): Promise<{ id?: string; error?: string }> {
  const v = validatePackageInput(pkg);
  if (!v.ok) return { error: v.error };
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("product_packages")
    .insert({
      product_id:    productId,
      package_name:  pkg.package_name.trim(),
      contains_qty:  pkg.contains_qty,
      package_price: pkg.package_price,
    })
    .select("id")
    .single();
  if (error || !data) return { error: error?.message ?? "تعذّر الإضافة" };
  revalidatePath(`/products/${productId}`);
  return { id: data.id };
}

export async function updatePackage(packageId: string, pkg: PackageInput): Promise<{ error?: string }> {
  const v = validatePackageInput(pkg);
  if (!v.ok) return { error: v.error };
  const supabase = await createClient();
  const { error } = await supabase
    .from("product_packages")
    .update({
      package_name:  pkg.package_name.trim(),
      contains_qty:  pkg.contains_qty,
      package_price: pkg.package_price,
    })
    .eq("id", packageId);
  if (error) return { error: error.message };
  return {};
}

export async function deletePackage(packageId: string): Promise<{ error?: string }> {
  const supabase = await createClient();
  const { count } = await supabase
    .from("visit_lines")
    .select("id", { count: "exact", head: true })
    .eq("package_id", packageId);
  if ((count ?? 0) > 0) {
    const { error } = await supabase.from("product_packages").update({ is_active: false }).eq("id", packageId);
    if (error) return { error: error.message };
  } else {
    const { error } = await supabase.from("product_packages").delete().eq("id", packageId);
    if (error) return { error: error.message };
  }
  return {};
}
