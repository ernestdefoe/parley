import app from 'flarum/admin/app';
import Extend from 'flarum/common/extenders';
import RoomsManager from './components/RoomsManager';

const t = (key: string) => app.translator.trans('ernestdefoe-parley.admin.' + key);

/** A number setting; its default lives in extend.php's Extend\Settings. */
const number = (key: string, min: number, max: number) => () => ({
  setting: 'ernestdefoe-parley.' + key,
  type: 'number',
  min,
  max,
  label: t('settings.' + key),
  help: t('settings.' + key + '_help'),
});

export default [
  new Extend.Admin()
    .permission(() => ({ icon: 'fas fa-comments', label: t('permissions.use'), permission: 'ernestdefoe-parley.use' }), 'start')
    .permission(
      () => ({ icon: 'fas fa-user-secret', label: t('permissions.hide_from_list'), permission: 'ernestdefoe-parley.hideFromList' }),
      'moderate'
    )
    .permission(() => ({ icon: 'fas fa-flag', label: t('permissions.moderate'), permission: 'ernestdefoe-parley.moderate' }), 'moderate')
    .customSetting(() => (
      <div className="Form-group">
        <label>{t('rooms.title')}</label>
        <RoomsManager />
      </div>
    ))
    .setting(number('away_minutes', 1, 120))
    .setting(number('max_image_mb', 1, 50))
    .setting(number('max_file_mb', 1, 200))
    .setting(number('max_voice_seconds', 10, 900))
    .setting(number('group_max_members', 3, 250)),
];
