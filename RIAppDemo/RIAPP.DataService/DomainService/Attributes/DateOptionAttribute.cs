﻿using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;

namespace RIAPP.DataService
{
    [AttributeUsage(AttributeTargets.Parameter, AllowMultiple=false, Inherited=false)]
    public class DateOptionAttribute: Attribute
    {
        public DateOptionAttribute()
        {
            dateConversion = DateConversion.None;
        }

        public DateConversion dateConversion
        {
            get;
            set;
        }
    }
}
