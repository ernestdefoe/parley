import RoomsManager from './components/RoomsManager';
import app from 'flarum/admin/app';

app.initializers.add('ernestdefoe-parley', () => {
  app.registry
    .for('ernestdefoe-parley')
    .registerPermission(
      {
        icon: 'fas fa-comments',
        label: app.translator.trans('ernestdefoe-parley.admin.permissions.use'),
        permission: 'ernestdefoe-parley.use',
      },
      'start'
    )
    .registerPermission(
      {
        icon: 'fas fa-user-secret',
        label: app.translator.trans('ernestdefoe-parley.admin.permissions.hide_from_list'),
        permission: 'ernestdefoe-parley.hideFromList',
      },
      'moderate'
    )
    .registerPermission(
      {
        icon: 'fas fa-flag',
        label: app.translator.trans('ernestdefoe-parley.admin.permissions.moderate'),
        permission: 'ernestdefoe-parley.moderate',
      },
      'moderate'
    )
    .registerSetting(() => (
      <div className="Form-group">
        <label>{app.translator.trans('ernestdefoe-parley.admin.rooms.title')}</label>
        <RoomsManager />
      </div>
    ))
    .registerSetting({
      setting: 'ernestdefoe-parley.away_minutes',
      type: 'number',
      min: 1,
      max: 120,
      label: app.translator.trans('ernestdefoe-parley.admin.settings.away_minutes'),
      help: app.translator.trans('ernestdefoe-parley.admin.settings.away_minutes_help'),
    })
    .registerSetting({
      setting: 'ernestdefoe-parley.max_image_mb',
      type: 'number',
      min: 1,
      max: 50,
      label: app.translator.trans('ernestdefoe-parley.admin.settings.max_image_mb'),
      help: app.translator.trans('ernestdefoe-parley.admin.settings.max_image_mb_help'),
    })
    .registerSetting({
      setting: 'ernestdefoe-parley.max_file_mb',
      type: 'number',
      min: 1,
      max: 200,
      label: app.translator.trans('ernestdefoe-parley.admin.settings.max_file_mb'),
      help: app.translator.trans('ernestdefoe-parley.admin.settings.max_file_mb_help'),
    })
    .registerSetting({
      setting: 'ernestdefoe-parley.max_voice_seconds',
      type: 'number',
      min: 10,
      max: 900,
      label: app.translator.trans('ernestdefoe-parley.admin.settings.max_voice_seconds'),
      help: app.translator.trans('ernestdefoe-parley.admin.settings.max_voice_seconds_help'),
    })
    .registerSetting({
      setting: 'ernestdefoe-parley.group_max_members',
      type: 'number',
      min: 3,
      max: 250,
      label: app.translator.trans('ernestdefoe-parley.admin.settings.group_max_members'),
      help: app.translator.trans('ernestdefoe-parley.admin.settings.group_max_members_help'),
    });
});
