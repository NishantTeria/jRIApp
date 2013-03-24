using System;
using System.Runtime.Serialization;
using System.ComponentModel;
using System.Collections.Generic;
using System.Reflection;
using System.Web.Script.Serialization;
using System.Linq;
using RIAPP.DataService.Utils;

namespace RIAPP.DataService
{
    /// <summary>
    /// Stores information about parameter
    /// used to check values recieved from client
    /// before service method invocations
    /// </summary>
    [DataContract]
    public class ParamMetadataInfo
    {
        public ParamMetadataInfo()
        {
            this.name = "";
            this.dataType = DataType.None;
            this.ordinal = -1;
            this.isNullable = false;
            this.isArray = false;
            this.dateConversion = DateConversion.None;
        }

        [DataMember]
        [Description("Parameter name")]
        public string name
        {
            get;
            set;
        }

        [DataMember]
        [Description("Parameter type")]
        public DataType dataType
        {
            get;
            set;
        }

        [DataMember]
        [Description("True if parameter is array")]
        public bool isArray
        {
            get;
            set;
        }

        [DataMember]
        [Description("Parameter position")]
        public bool isNullable
        {
            get;
            set;
        }

        [DataMember]
        [Description("How adjust date timezone between server and client")]
        public DateConversion dateConversion
        {
            get;
            set;
        }

        [DataMember]
        [Description("Parameter position")]
        public int ordinal
        {
            get;
            set;
        }

        [IgnoreDataMember]
        [ScriptIgnore]
        public Type ParameterType
        {
            get;
            set;
        }

        /// <summary>
        /// Extracts from ParameterInfo all information about method parameter
        /// returns InvokeParamInfo
        /// </summary>
        /// <param name="pinfo"></param>
        /// <returns></returns>
        public static ParamMetadataInfo FromParamInfo(ParameterInfo pinfo) {
            Type ptype = pinfo.ParameterType;
            if (pinfo.IsOut)
                throw new DomainServiceException("Out parameters are not supported in service methods");
            ParamMetadataInfo res = new ParamMetadataInfo();
            res.isNullable = DataHelper.IsNullableType(ptype);
            res.name = pinfo.Name;
            res.ParameterType = ptype;
            Type realType = null;
            if (!res.isNullable)
                realType = ptype;
            else
                realType = Nullable.GetUnderlyingType(ptype);
            object[] dtops = pinfo.GetCustomAttributes(typeof(DateOptionAttribute), false);
            if (dtops.Length > 0) {
               res.dateConversion = (dtops[0] as DateOptionAttribute).dateConversion;
            }
            bool isArray = false;
            res.dataType = DataHelper.DataTypeFromType(realType, out isArray);
            res.isArray = isArray;
            return res;
        }
    }

    [DataContract]
    public class MethodDescription
    {

        public MethodDescription()
        {
            this.parameters = new List<ParamMetadataInfo>();
            this.methodResult = false;
        }

        [DataMember]
        public string methodName
        {
            get;
            set;
        }

        [DataMember]
        public List<ParamMetadataInfo> parameters
        {
            get;
            set;
        }

        [DataMember]
        [Description("Returns or not result from method invocation")]
        public bool methodResult
        {
            get;
            set;
        }

        [DataMember]
        [Description("is it Query method")]
        public bool isQuery
        {
            get;
            set;
        }

        [IgnoreDataMember]
        [ScriptIgnore]
        public MethodInfo methodInfo
        {
            get;
            set;
        }

        public static MethodDescription FromMethodInfo(MethodInfo methodInfo, bool isQuery) {
            Type returnType = methodInfo.ReturnType;
            bool isVoid = returnType == typeof(void);
            MethodDescription invInfo = new MethodDescription();
            invInfo.methodInfo = methodInfo;
            invInfo.methodName = methodInfo.Name;
            invInfo.isQuery = isQuery;

            if (!isVoid)
                invInfo.methodResult = true;
            //else Result is Converted to JSON
            ParameterInfo[] paramsInfo = methodInfo.GetParameters();
            for (var i = 0; i < paramsInfo.Length; ++i) {
                if (isQuery && paramsInfo[i].ParameterType == typeof(GetDataInfo))
                    continue;
                ParamMetadataInfo param = ParamMetadataInfo.FromParamInfo(paramsInfo[i]);
                param.ordinal = i;
                invInfo.parameters.Add(param);
            }
            return invInfo;
        }
    }

}
