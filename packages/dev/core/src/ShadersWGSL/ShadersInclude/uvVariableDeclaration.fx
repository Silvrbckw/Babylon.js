#if !defined(UV{X}) && defined(MAINUV{X})
	var uv: vec2f{X} =  vec2f(0., 0.);
#endif
#ifdef MAINUV{X}
	vMainUV{X} = uv{X};
#endif
