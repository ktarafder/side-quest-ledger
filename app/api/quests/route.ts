const retired = () => Response.json({error:"Please refresh the app to use the member board."},{status:410});
export const GET=retired; export const POST=retired; export const PATCH=retired; export const DELETE=retired;
