"""Blender 4.x: --background --python tools/voxel/import-essential-animation.py -- source.zip output-directory.
The supplied archive has animations and a 25-joint armature, no character mesh.
Bake each source's WORLD-space bone transforms onto Idle's hierarchy: FBX files may differ in bone basis.
"""
import bpy, hashlib, json, sys, tempfile, zipfile
from pathlib import Path

args=sys.argv[sys.argv.index('--')+1:]
source=Path(args[0]); output=Path(args[1]); output.mkdir(parents=True,exist_ok=True)
with tempfile.TemporaryDirectory() as temp:
    with zipfile.ZipFile(source) as archive:
        for name in ['Idle','Run','Attack','Hit','Death']:
            Path(temp,f'{name}.fbx').write_bytes(archive.read(f'{name}.fbx'))
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.fbx(filepath=str(Path(temp,'Idle.fbx')))
    target=next(o for o in bpy.data.objects if o.type=='ARMATURE')
    target.animation_data.action=None
    for p in target.pose.bones:p.rotation_mode='QUATERNION'
    manifest={'archive':source.name,'archiveSHA256':hashlib.sha256(source.read_bytes()).hexdigest(),'bones':len(target.data.bones),'sourceMeshes':0,'fps':30,'clips':{}}
    actions=[]
    for name in ['Idle','Run','Attack','Hit','Death']:
        previous=set(bpy.data.objects)
        fbx=Path(temp,f'{name}.fbx')
        bpy.ops.import_scene.fbx(filepath=str(fbx))
        rig=next(o for o in set(bpy.data.objects)-previous if o.type=='ARMATURE')
        source_action=rig.animation_data.action
        start,end=map(round,source_action.frame_range)
        action=bpy.data.actions.new(name)
        target.animation_data.action=action
        for frame in range(start,end+1):
            bpy.context.scene.frame_set(frame)
            matrices={p.name:target.matrix_world.inverted() @ rig.matrix_world @ p.matrix for p in rig.pose.bones}
            for p in target.pose.bones:
                kw={'parent_matrix':matrices[p.parent.name],'parent_matrix_local':p.parent.bone.matrix_local} if p.parent else {}
                p.matrix_basis=p.bone.convert_local_to_pose(matrices[p.name],p.bone.matrix_local,invert=True,**kw)
                for path in ['location','rotation_quaternion','scale']:p.keyframe_insert(data_path=path,frame=frame-start,group=p.name)
        for curve in action.fcurves:
            for key in curve.keyframe_points:key.interpolation='LINEAR'
        actions.append(action)
        manifest['clips'][name]={'sourceSHA256':hashlib.sha256(fbx.read_bytes()).hexdigest(),'duration':(end-start)/30,'frames':end-start+1,'sourceFrameStart':start,'sourceFrameEnd':end}
        target.animation_data.action=None
        for obj in set(bpy.data.objects)-previous:bpy.data.objects.remove(obj,do_unlink=True)
    for action in actions:
        track=target.animation_data.nla_tracks.new();track.name=action.name
        strip=track.strips.new(action.name,0,action);strip.name=action.name;track.mute=True
    target.animation_data.nla_tracks[0].mute=False
    bpy.context.scene.render.fps=30
    bpy.context.scene.frame_set(0)
    bpy.ops.object.select_all(action='DESELECT');target.select_set(True);bpy.context.view_layer.objects.active=target
    bpy.ops.export_scene.gltf(filepath=str(output/'essential.glb'),export_format='GLB',use_selection=True,export_animations=True,export_animation_mode='NLA_TRACKS',export_frame_range=False,export_force_sampling=True,export_anim_slide_to_zero=True,export_def_bones=True,export_rest_position_armature=True)
    manifest['glbSHA256']=hashlib.sha256((output/'essential.glb').read_bytes()).hexdigest()
    (output/'manifest.json').write_text(json.dumps(manifest,indent=2)+'\n')
