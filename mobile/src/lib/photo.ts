/**
 * Picking a profile photo: the camera or the gallery, cropped square in the
 * picker, then resized to 512×512 JPEG on the phone so the upload stays far
 * below the server's 2 MB limit. Permission is asked only for the source the
 * student chose, and only when it is needed.
 */
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';

export type PhotoSource = 'camera' | 'gallery';

/** The size the server stores (see the API's CLOUDINARY_INCOMING.avatars). */
const AVATAR_SIZE = 512;

export const PERMISSION_MESSAGES: Record<PhotoSource, string> = {
  camera:
    'GuessUp needs the camera to take your photo. To allow it, open your phone’s Settings › Apps › GuessUp (or Expo Go) › Permissions › Camera.',
  gallery:
    'GuessUp needs access to your photos to choose one. To allow it, open your phone’s Settings › Apps › GuessUp (or Expo Go) › Permissions › Photos and videos.',
};

/** Thrown when the student said no; its message says how to allow it in Settings. */
export class PermissionDeniedError extends Error {}

async function ensurePermission(source: PhotoSource): Promise<void> {
  const get =
    source === 'camera'
      ? ImagePicker.getCameraPermissionsAsync
      : ImagePicker.getMediaLibraryPermissionsAsync;
  const request =
    source === 'camera'
      ? ImagePicker.requestCameraPermissionsAsync
      : ImagePicker.requestMediaLibraryPermissionsAsync;
  let status = await get();
  if (!status.granted && status.canAskAgain) status = await request();
  if (!status.granted) throw new PermissionDeniedError(PERMISSION_MESSAGES[source]);
}

/** The local URI of a 512×512 JPEG, or null when the student cancelled. */
export async function pickAvatar(source: PhotoSource): Promise<string | null> {
  await ensurePermission(source);
  const options: ImagePicker.ImagePickerOptions = {
    mediaTypes: ['images'],
    allowsEditing: true,
    aspect: [1, 1],
    quality: 1,
  };
  const result =
    source === 'camera'
      ? await ImagePicker.launchCameraAsync(options)
      : await ImagePicker.launchImageLibraryAsync(options);
  const asset = result.canceled ? undefined : result.assets[0];
  if (!asset) return null;

  // The crop is square already; resizing both sides only fixes the size.
  const image = await ImageManipulator.manipulate(asset.uri)
    .resize({ width: AVATAR_SIZE, height: AVATAR_SIZE })
    .renderAsync();
  const saved = await image.saveAsync({ format: SaveFormat.JPEG, compress: 0.8 });
  return saved.uri;
}
