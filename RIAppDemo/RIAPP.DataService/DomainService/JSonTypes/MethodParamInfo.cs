using System;
using System.Runtime.Serialization;
using System.ComponentModel;
using System.Collections;
using System.Collections.Generic;
using System.Linq;
using RIAPP.DataService.Utils;

namespace RIAPP.DataService
{
    /// <summary>
    /// Stores parameter description (it's attributes)
    /// </summary>
    [DataContract]
    public class Parameter
    {
        public Parameter()
        {
            this.name = "";
            this.value = null;
        }

        [DataMember]
        [Description("Parameter name")]
        public string name
        {
            get;
            set;
        }

     
        [DataMember]
        [Description("Parameter value as string")]
        public string value
        {
            get;
            set;
        }
    }

    [DataContract]
    public class MethodParamInfo
    {
        public MethodParamInfo()
        {
            this.parameters = new List<Parameter>();
        }

        [DataMember]
        public List<Parameter> parameters
        {
            get;
            set;
        }

        public object GetValue(string name, MethodDescription methodDescription)
        {
            var par = this.parameters.Where(p => p.name == name).FirstOrDefault();
            if (par == null)
                return null;
            var paraminfo = methodDescription.parameters.Where(p => p.name == name).FirstOrDefault();
            if (paraminfo == null)
            {
                throw new DomainServiceException(string.Format("Method: {0} has no parameter with the name: {1}",methodDescription.methodName, name));
            }
            return DataHelper.ParseParameter(paraminfo.ParameterType, paraminfo, paraminfo.isArray, par.value);
        }
    }

}
